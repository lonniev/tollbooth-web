- **Breaking:** `AccountPage` draws its sections in groups, each a `<details>` that folds:
  - **You**: Nostr profile, appearance, time zone, session key, then Log out.
  - **Money**: usage, peers.
  - **This site**.
  - **Operator**: drawn for the operator alone.
  - **About**: build.

  `before`, `between` and `after` are gone. A site hands its own panels to `panels.you`, `panels.money`, `panels.site` or `panels.operator`. A group's body is a grid, never CSS columns, which split cards.
- A guided tour step whose control sits inside a folded `<details>` opens it first.
- `OperatorProperties` shows each property's description as a line under it (it was only a hover title, which a tablet never shows), and a number's value with its unit (`PropertyInfo.unit`, new in tollbooth-dpyc), such as "75%" or "3 commissions". Inside the Operator group it draws no heading of its own.
