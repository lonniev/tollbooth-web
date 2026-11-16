import { account } from "./en/account.ts";
import { common } from "./en/common.ts";
import { shell } from "./en/shell.ts";
import { signin } from "./en/signin.ts";
import { wallet } from "./en/wallet.ts";

export const en = { ...common, ...signin, ...wallet, ...account, ...shell } as const;
