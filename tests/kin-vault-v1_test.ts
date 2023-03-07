
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.28.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Only Owner can deposit",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "deposit", ["u1000"], deployer.address),
            Tx.contractCall("kin-protocol-v1", "deposit", ["u1000"], wallet1.address),
        ]);

        block.receipts[1].result.expectErr();

        chain.callReadOnlyFn("kin-protocol-v1", "get-balance", [], deployer.address).result.expectUint(1000);
    },
});

Clarinet.test({
    name: "Only Owner can withdraw",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "deposit", ["u1000"], deployer.address),
        ]);

        chain.callReadOnlyFn("kin-protocol-v1", "get-balance", [], deployer.address).result.expectUint(1000);

        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "withdraw", ["u500"], deployer.address),
            Tx.contractCall("kin-protocol-v1", "withdraw", ["u500"], wallet1.address),
        ]);

        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectErr().expectUint(1);
        chain.callReadOnlyFn("kin-protocol-v1", "get-balance", [], deployer.address).result.expectUint(500);


    },
});

Clarinet.test({
    name: "Only Owner can update treshold",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "update-threshold", ["u10"], deployer.address),
            Tx.contractCall("kin-protocol-v1", "update-threshold", ["u10"], wallet1.address),
        ]);

        block.receipts[1].result.expectErr();
        
        let deposit = chain.callReadOnlyFn("kin-protocol-v1", "get-threshold", [], deployer.address);
        deposit.result.expectUint(10);
    },
});

Clarinet.test({
    name: "Only Owner can add kin",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let wallet3 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "add-kin-wallets", [`(list '${wallet1.address} '${wallet2.address} '${wallet3.address})`], deployer.address),
            Tx.contractCall("kin-protocol-v1", "add-kin-wallets", [`(list '${wallet1.address} '${wallet2.address} '${wallet3.address})`], wallet1.address),
        ]);

        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectErr();

    },
});

Clarinet.test({
    name: "Participants can only ping and withdraw when the threshold has been exceeded to their position in the scale",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let wallet3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "add-kin-wallets", [`(list '${wallet1.address} '${wallet2.address})`], deployer.address),
            Tx.contractCall("kin-protocol-v1", "deposit", ["u1000"], deployer.address),
        ]);

        block.receipts[0].result.expectOk();

        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "ping", [], wallet1.address),
            Tx.contractCall("kin-protocol-v1", "ping", [], wallet2.address),
            Tx.contractCall("kin-protocol-v1", "ping", [], wallet3.address),
            Tx.contractCall("kin-protocol-v1", "ping", [], deployer.address),
        ])

        block.receipts[0].result.expectErr();
        block.receipts[1].result.expectErr();
        block.receipts[2].result.expectErr();
        block.receipts[3].result.expectOk();

        block.receipts[2].result.expectErr().expectUint(6) // not on the list like

        block.receipts[1].result.expectErr().expectUint(5) // these ones are on the list but have not reached threshold
        block.receipts[0].result.expectErr().expectUint(5)



        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "update-threshold", ["u10"], deployer.address),
        ])

        chain.callReadOnlyFn("kin-protocol-v1", "get-threshold", [], deployer.address).result.expectUint(10)

        //mining 20 extra blocks so the threshold from the last ping (11) is exceeded
        chain.mineEmptyBlockUntil(21);

        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "ping", [], wallet2.address),
            Tx.contractCall("kin-protocol-v1", "ping", [], wallet1.address),
        ])

        block.receipts[0].result.expectErr().expectUint(5)
        block.receipts[1].result.expectOk().expectUint(1)

        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "kin-withdraw", [], wallet2.address),
            Tx.contractCall("kin-protocol-v1", "kin-withdraw", [], wallet3.address),
            Tx.contractCall("kin-protocol-v1", "kin-withdraw", [], wallet1.address),
        ])

        block.receipts[0].result.expectErr().expectUint(5)
        block.receipts[1].result.expectErr().expectUint(4)
        block.receipts[2].result.expectOk();
    },
});

Clarinet.test({
    name: "NFTS are handled properly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        let wallet1 = accounts.get("wallet_1")!;
        let wallet2 = accounts.get("wallet_2")!;
        let wallet3 = accounts.get("wallet_3")!;

        const contract_name = deployer.address+"."+"kin-protocol-v1"

        let block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "add-kin-wallets", [`(list '${wallet1.address} '${wallet2.address})`], deployer.address),
        ]);

        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u1"], deployer.address).result.expectSome().expectPrincipal(wallet1.address)
        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u2"], deployer.address).result.expectSome().expectPrincipal(wallet2.address)
        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u3"], deployer.address).result.expectNone()


        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "add-kin-wallets", [`(list '${wallet1.address} '${wallet3.address})`], deployer.address),
        ]);

        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u1"], deployer.address).result.expectSome().expectPrincipal(wallet1.address)
        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u2"], deployer.address).result.expectSome().expectPrincipal(wallet3.address)
        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u3"], deployer.address).result.expectNone()
    
        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "add-kin-wallets", [`(list '${wallet1.address} '${wallet3.address} '${wallet2.address})`], deployer.address),
        ]);

        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u3"], deployer.address).result.expectSome().expectPrincipal(wallet2.address)

        block = chain.mineBlock([
            Tx.contractCall("kin-protocol-v1", "add-kin-wallets", [`(list '${wallet2.address})`], deployer.address),
        ]);

        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u2"], deployer.address).result.expectSome().expectPrincipal(contract_name)
        chain.callReadOnlyFn("kin-protocol-v1", "get-NFT-owner", ["u3"], deployer.address).result.expectSome().expectPrincipal(contract_name)
        
    },
});