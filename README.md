# Kin's Protocol

The application is a next of kin implementation for the Stacks token. 
The application takes a list of addresses (max of 3) and puts them in a queue in the order that they came in. These addresses would be able to access the funds in the contract deposited by the deployer if the deployer does not notify the contract of his or her activeness within a particular threshold set by the deployer.

## Public methods


``` (add-kin-wallets (wallets (list 3 principal)) ```
This method sets and update the next of kin queue or list in order. These are wallets that would be able to access deposited funds in the wallet after the owner has not been active for an amount of time in block height referred to as the `threshold`. It can only be used by the `owner` of the contract

``` (deposit (amount uint)) ```
``` (withdraw (amount uint)) ```
These methods are used by the the Deployer / `owner` only to deposit and withdraw STX to and from the contract.

``` (kin-withdraw) ```
This method is used can only be used by the wallets listed as next of kins to withdraw every deposit on the contract. It would only be accessible if the caller is 
  1. On the list of kin
  2. if the span from the last activity by the deployer or any of the participant to the present block height has exceeded their own threshold
  
  
``` (ping) ```
This method is used to register presence or activity by either of the participants by updating the `last-pinged-height` variable to the present block height. It is used to prevent the exceeding the `threshold`. When User A calls the ping method or carries out any taransction on the contract, they signify that they are still active and postpone the threshold

``` (update-threshold (height uint)) ``` 
Only the `owner` can call this method. like it denotes, it is used to update the `threshold` which is the amount of time from the last active moment `last-pinged-height` to the present blochain. if that `span` of time is equal or greater the `threshold`, the next person on the queue would have access to the deposited fund


## Kin NFT 
For every participant, An NFT is minted and transefered to their wallets to denote their participation and their position on the queue. Their position is denoted by ` index on the list + 1 ` and their NFT token ID. This position also denotes how much of the `threshold` would pass without any activity from any participant, before they can get access. This is what is called the `span` and it is the product of their position and the threshold.
The NFT is mostly important to help the frontend know the various Kins a user is affiliated with and the user's respective positions
