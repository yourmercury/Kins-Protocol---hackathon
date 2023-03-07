;; A vault is like a bank, only that it stores tokens in case of eventuality like a lost private key or incase of demise or incapacition

;; the protocol uses NFTs that are externally non transferable to represent a users participation in the kin queue
(define-non-fungible-token kin uint)
;; the vault owner is allocated an NFT representing his position as number 1
(nft-mint? kin u0 tx-sender) ;; the name of the nft would be dynamic at deployment

;; NFT nonce 
(define-data-var nonce uint u1)

;; This is the store of kin by order
(define-data-var kins-wallets (list 3 principal) (list ))

(define-constant owner tx-sender)

;; This is the period in which the owner can confirm that he is still active or else, the next of kin would 
;; be able to access their funds
(define-data-var threshold uint u4320) ;; Using 10mins per block;; default threshold is one month ---> 30 days * 24h * 60 mins / 10mins ---> 4320 blocks
(define-data-var last-pinged-height uint block-height)


;; ERRORS defined here
(define-constant ERROR_OWNER_ONLY (err u1))
(define-constant ERROR_NOT_ENOUGH_BALANCE (err u2))
(define-constant ERROR_STX_TRANSFER_FAILED (err u3))
(define-constant ERROR_NOT_ON_KIN_LIST (err u4))
(define-constant ERROR_THRESHOLD_NOT_YET_EXCEEDED (err u5))
(define-constant ERROR_UNAUTHORIZED (err u6))
(define-constant ERROR_BELOW_MIN_HEIGHT (err u7))
(define-constant ERROR_ABOVE_MAX_HEIGHT (err u8))
(define-constant ERROR_REGISTRY_IS_DOWN (err u9))
(define-constant ERROR_NFT_TRANSFER_FAILED (err u10))
(define-constant ERROR_CONTRACT_ERROR (err u11))


;; private function that stores kins on the map
(define-private (fold-wallet (x uint) (index uint))  
    (match (element-at (var-get kins-wallets) index)
        wallet
        (let (
            ;; We call this to allocate NFTs to the participant on the queue
            (do (handle-nfts wallet index))
        )
            (+ index u1)
        )
        (let (
            ;; this parts run just incase for instance the participants have been reduced to 1 from 3. We wan to make sure that the former participants 
            ;; do not own NFTs from this contract anymore
            (token-owner-option (nft-get-owner? kin (+ index u1)))
        )
            (match token-owner-option
                token-owner
                (let (
                    (do (nft-transfer? kin (+ index u1) token-owner (as-contract tx-sender)))
                    )
                    (+ index u1)
                )
                (+ u1 index)
            )
        )
    )
)

;; private function that allocates NFTs to next of kins to signify their addition to the queue
;; their token ID represents their position on the queue
(define-private (handle-nfts (wallet principal) (position uint)) 
    (match (nft-get-owner? kin (+ u1 position)) 
        nft-owner
        ;; would move the NFT from the previous participant to the new on if the NFT was already owned
        (nft-transfer? kin (+ u1 position) nft-owner wallet)
        ;; if not, mint one for the participant
        (nft-mint? kin (+ u1 position) wallet)
    )
)

;; PUBLIC function for adding kins
;; This function also serves as a means to edit the kins.

;; this loop list is a dummy list to make the fold loop 3 times so as to be able to recorver all NFTs
(define-data-var loop (list 3 uint) (list u1 u2 u3))
(define-public (add-kin-wallets (wallets (list 3 principal))) 
    (begin
        (asserts! (is-eq tx-sender owner) ERROR_OWNER_ONLY)
        (asserts! (is-ok (ping)) ERROR_OWNER_ONLY)
        (var-set kins-wallets wallets)
        (fold fold-wallet (var-get loop) u0)
        (ok u1)
    )
)


;; PUBLIC function for depositing
(define-public (deposit (amount uint)) 
    (begin 
        (asserts! (is-eq tx-sender owner) ERROR_OWNER_ONLY)
        (asserts! (> (stx-get-balance tx-sender) amount) ERROR_NOT_ENOUGH_BALANCE)
        ;; Transfer Amount ro contract
        (unwrap! (stx-transfer? amount tx-sender (as-contract tx-sender)) ERROR_STX_TRANSFER_FAILED)
        (asserts! (is-ok (ping)) ERROR_OWNER_ONLY)
        (ok u1)
    )
)


;; PUBLIC function for withdrawing
(define-public (withdraw (amount uint)) 
    (let (
        (wallet tx-sender)
    )
        (asserts! (is-eq tx-sender owner) ERROR_OWNER_ONLY)
        (asserts! (>= (stx-get-balance (as-contract tx-sender)) amount) ERROR_NOT_ENOUGH_BALANCE)
        ;; Transfer Amount to contract
        (print (as-contract tx-sender))
        (unwrap! (as-contract (stx-transfer? amount tx-sender wallet)) ERROR_STX_TRANSFER_FAILED)
        (asserts! (is-ok (ping)) ERROR_OWNER_ONLY)
        (ok u1)
    )
)



;;PUBLIC function for kin to be able to withdraw from
(define-public (kin-withdraw) 
    (match (index-of (var-get kins-wallets) tx-sender)
        position
        (let (
            (span (- block-height (var-get last-pinged-height)))
            (wallet tx-sender)
            ) 
            (asserts! (>= span (* (var-get threshold) (+ position u1))) ERROR_THRESHOLD_NOT_YET_EXCEEDED)
            (asserts! (> (get-balance ) u0) ERROR_NOT_ENOUGH_BALANCE)
            (unwrap! (as-contract (stx-transfer? (get-balance ) tx-sender wallet)) ERROR_STX_TRANSFER_FAILED)
            (var-set last-pinged-height block-height)
            (ok u1)
        )
        ERROR_NOT_ON_KIN_LIST
    )
)


;; PUBLIC function to ping contract reset last-pinged-height
(define-public (ping) 
    (match (index-of (var-get kins-wallets) tx-sender)
        position
        (begin
            ;; assertion to prevent runtime error when the threshold is greater than the block-height
            ;; an example of this problem is calling ping at the genesis block
            (asserts! (> block-height (* (var-get threshold) (+ position u1))) ERROR_THRESHOLD_NOT_YET_EXCEEDED)
            (let (
                ;; this is the duaration from the present block height to the last height where the owner or next of kins pinged
                (span (- block-height (var-get last-pinged-height)))
                ;; the favourable height is the height that would not exceed this participant's threshold. so this height will update the last-pinged- height
                ;; variable so that the span would be within their threshold and not exceed to give the next in queue access to the funds
                (favourable-height (- block-height (* (var-get threshold) (+ position u1))))
                ) 
                (asserts! (>= span (* (var-get threshold) (+ position u1))) ERROR_THRESHOLD_NOT_YET_EXCEEDED)
                (var-set last-pinged-height favourable-height)
                (ok u1)
            )
        )
        (begin 
            (asserts! (is-eq tx-sender owner) ERROR_UNAUTHORIZED)
            ;; this happens when the owner of the contract pings
            (var-set last-pinged-height block-height)
            (ok u1)
        )
    )
)


;; PUBLIC function to reset Threshold
(define-public (update-threshold (height uint)) 
    (begin
        (asserts! (is-eq tx-sender owner) ERROR_OWNER_ONLY)
        (asserts! (>= height u10) ERROR_BELOW_MIN_HEIGHT)
        ;; Make sure that the threshold does not exeed the max of roughly 6 Months
        (asserts! (<= height u25920) ERROR_BELOW_MIN_HEIGHT)
        (var-set threshold height)
        (ok u1)
    )
)


(define-read-only (get-balance) (stx-get-balance (as-contract tx-sender)))
(define-read-only (get-threshold) (var-get threshold))
(define-read-only (get-last-ping-height) (var-get last-pinged-height))

(define-read-only (get-NFT-owner (id uint)) 
    (nft-get-owner? kin id)
)