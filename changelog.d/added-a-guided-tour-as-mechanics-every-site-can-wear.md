- A guided tour, as mechanics: `TourProvider`, `useTour`, `useTourSwitch`,
  `useTourReplay` and `tourTarget` in `/react`; the preference under
  `<prefix>:tour:v1` (on, toured, replay) with its rules in `tour/state`; the
  offer ("Would you like a tour of this page?") after ten seconds untouched,
  settable with `configureTollbooth({ tourIdleMs })`; `lintTours` for a site's
  copy; and the two tours every site shares, `signInTour()` and
  `accountTour()`, pointing at `data-tour` names the gate and the account
  panels now carry (`TB_TARGETS`). Lifted from Good Earth's tour; a site
  supplies its names and its words (owner: "let's go DRY", and "trigger on
  extended idleness"). driver.js 1.9.0 is the package's first runtime
  dependency; `tour.css` draws its popover in the site's tokens.
- A device that already holds a patron npub but no tour preference starts with
  the tutorial off: a patron who has been here a season is shown nothing until
  they ask.
