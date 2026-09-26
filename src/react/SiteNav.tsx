/**
 * The top bar: the site's brand, its pages, and on the right whatever the site
 * keeps there (a balance chip) and the account menu (avatar → identity, links,
 * log out). On a phone the pages fold into a menu button.
 *
 * Mechanics only. The package owns which page is current, the phone fold, the
 * two popovers (aria-expanded, focus into the menu and back to its button,
 * Escape, a press outside, the arrow keys) and 40 px tap targets; every class
 * is the site's, through `classNames` — with none it is plain markup.
 *
 * Router-agnostic: `isActive(href, item)` says which page is current and
 * `renderLink` draws each link (a react-router `<Link to>`); by default the
 * links are plain `<a href>` and the current page is read from
 * `location.pathname`. `matchesPath` is the matching a site's `isActive`
 * usually wants.
 */

import { useEffect, useId, type CSSProperties, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import Avatar from "./Avatar.tsx";
import { cx } from "./cx.ts";
import { matchesPath } from "./navState.ts";
import { useAvatar } from "./useAvatar.ts";
import { useDisclosure } from "./useDisclosure.ts";
import { useMediaQuery } from "./useMediaQuery.ts";

export interface SiteNavItem {
  href: string;
  label: ReactNode;
  icon?: ReactNode;
  /** A count or mark after the label; nothing when null or undefined. */
  badge?: ReactNode;
  /** Current only on this exact path, not the pages beneath it (the home item). */
  end?: boolean;
  title?: string;
}

export interface SiteNavLinkProps {
  href: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  "aria-current"?: "page";
  onClick?: () => void;
  children: ReactNode;
}

export interface SiteNavAccount {
  npub: string;
  /** Over the npub in the menu. Default "Nostr identity". */
  heading?: ReactNode;
  /** The menu's links (Profile, Wallet). */
  links?: readonly SiteNavItem[];
  onSignOut?: () => void;
  /** Default "Log out". */
  signOutLabel?: ReactNode;
  /** Default 32. */
  avatarSize?: number;
  /** The avatar button's accessible name. Default "Account". */
  label?: string;
}

export interface SiteNavClassNames {
  root?: string;
  /** The `<nav>` holding the pages (or, folded, the menu button and menu). */
  nav?: string;
  /** The pages in a row. */
  list?: string;
  item?: string;
  /** Added to the current page's link, in the row and (unless `menuItemActive`) the menu. */
  active?: string;
  icon?: string;
  label?: string;
  badge?: string;
  /** The right side: `trailing` and the account menu. */
  end?: string;
  /** The phone menu's button, and the menu. */
  toggle?: string;
  menu?: string;
  menuItem?: string;
  menuItemActive?: string;
  /** The account menu's wrapper, avatar button and popover. */
  account?: string;
  accountButton?: string;
  accountMenu?: string;
  accountHeader?: string;
  accountHeading?: string;
  accountNpub?: string;
  accountLink?: string;
  signOut?: string;
}

export interface SiteNavProps {
  brand?: ReactNode;
  items: readonly SiteNavItem[];
  isActive?: (href: string, item: SiteNavItem) => boolean;
  renderLink?: (props: SiteNavLinkProps) => ReactNode;
  /** Drawn on the right, before the account menu: a balance chip, a Sign-in link. */
  trailing?: ReactNode;
  account?: SiteNavAccount;
  /** When the pages fold into a menu; false never folds. Default "(max-width: 639px)". */
  collapse?: string | false;
  /** The `<nav>`'s accessible name. Default "Main". */
  label?: string;
  /** The menu button's accessible name. Default "Menu". */
  menuLabel?: string;
  menuIcon?: ReactNode;
  closeIcon?: ReactNode;
  classNames?: SiteNavClassNames;
}

const TAP: CSSProperties = { minWidth: 40, minHeight: 40 };
const TAP_ROW: CSSProperties = { display: "flex", alignItems: "center", minHeight: 40 };

const plainLink = ({ children, ...p }: SiteNavLinkProps) => <a {...p}>{children}</a>;
const pathActive = (href: string, item: SiteNavItem) =>
  typeof location !== "undefined" && matchesPath(location.pathname, href, item.end);

export default function SiteNav({
  brand,
  items,
  isActive = pathActive,
  renderLink = plainLink,
  trailing,
  account,
  collapse = "(max-width: 639px)",
  label = "Main",
  menuLabel = "Menu",
  menuIcon = <Menu aria-hidden size={20} />,
  closeIcon = <X aria-hidden size={20} />,
  classNames: c = {},
}: SiteNavProps) {
  const folded = useMediaQuery(collapse);
  const menu = useDisclosure<HTMLElement, HTMLUListElement>();
  const menuId = useId();
  const { setOpen } = menu;

  // Widened past the fold with the menu open: nothing to close later.
  useEffect(() => {
    if (!folded) setOpen(false);
  }, [folded, setOpen]);

  const content = (item: SiteNavItem) => (
    <>
      {item.icon && (
        <span aria-hidden className={c.icon}>
          {item.icon}
        </span>
      )}
      <span className={c.label}>{item.label}</span>
      {item.badge != null && <span className={c.badge}>{item.badge}</span>}
    </>
  );

  return (
    <header className={c.root}>
      {brand}
      <nav aria-label={label} className={c.nav} ref={menu.rootRef}>
        {folded ? (
          <>
            <button
              ref={menu.buttonRef}
              type="button"
              aria-expanded={menu.open}
              aria-controls={menuId}
              aria-label={menuLabel}
              title={menuLabel}
              onClick={menu.toggle}
              className={c.toggle}
              style={TAP}
            >
              {menu.open ? closeIcon : menuIcon}
            </button>
            {menu.open && (
              <ul id={menuId} ref={menu.panelRef} onKeyDown={menu.onPanelKeyDown} className={c.menu}>
                {items.map((item) => {
                  const on = isActive(item.href, item);
                  return (
                    <li key={item.href}>
                      {renderLink({
                        href: item.href,
                        title: item.title,
                        "aria-current": on ? "page" : undefined,
                        onClick: () => menu.close(),
                        className: cx(c.menuItem, on && (c.menuItemActive ?? c.active)),
                        style: TAP_ROW,
                        children: content(item),
                      })}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <ul className={c.list}>
            {items.map((item) => {
              const on = isActive(item.href, item);
              return (
                <li key={item.href}>
                  {renderLink({
                    href: item.href,
                    title: item.title,
                    "aria-current": on ? "page" : undefined,
                    className: cx(c.item, on && c.active),
                    children: content(item),
                  })}
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {(trailing != null || account) && (
        <div className={c.end}>
          {trailing}
          {account && <AccountMenu account={account} isActive={isActive} renderLink={renderLink} c={c} />}
        </div>
      )}
    </header>
  );
}

function AccountMenu({
  account,
  isActive,
  renderLink,
  c,
}: {
  account: SiteNavAccount;
  isActive: (href: string, item: SiteNavItem) => boolean;
  renderLink: (props: SiteNavLinkProps) => ReactNode;
  c: SiteNavClassNames;
}) {
  const {
    npub,
    heading = "Nostr identity",
    links = [],
    onSignOut,
    signOutLabel = "Log out",
    avatarSize = 32,
    label = "Account",
  } = account;
  const avatar = useAvatar(npub);
  const menu = useDisclosure<HTMLDivElement, HTMLDivElement>();
  const menuId = useId();

  return (
    <div ref={menu.rootRef} className={c.account}>
      <button
        ref={menu.buttonRef}
        type="button"
        aria-expanded={menu.open}
        aria-controls={menuId}
        aria-label={label}
        title={npub}
        onClick={menu.toggle}
        className={c.accountButton}
        style={TAP}
      >
        <Avatar value={avatar} size={avatarSize} />
      </button>
      {menu.open && (
        <div id={menuId} ref={menu.panelRef} onKeyDown={menu.onPanelKeyDown} className={c.accountMenu}>
          <div className={c.accountHeader}>
            <div className={c.accountHeading}>{heading}</div>
            <div className={c.accountNpub} title={npub}>
              {npub}
            </div>
          </div>
          {links.map((item) => (
            <div key={item.href}>
              {renderLink({
                href: item.href,
                title: item.title,
                "aria-current": isActive(item.href, item) ? "page" : undefined,
                onClick: () => menu.close(),
                className: c.accountLink,
                style: TAP_ROW,
                children: item.label,
              })}
            </div>
          ))}
          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                menu.close();
                onSignOut();
              }}
              className={c.signOut}
              style={TAP_ROW}
            >
              {signOutLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
