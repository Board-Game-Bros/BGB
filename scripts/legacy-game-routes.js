// Old game bookmarks are handled centrally instead of root-level page stubs.
(() => {
  const routes = {
  "arkham_horror_lcg": "/games/ahlcg/",
  "arkham_horror_lcg_eote_20260906": "/games/ahlcg/eote_20260906/",
  "arkham_horror_lcg_eote_marion_tavares_20260906": "/games/ahlcg/eote_marion_tavares_20260906/",
  "arkham_horror_lcg_eote_preston_fairmont_20260906": "/games/ahlcg/eote_preston_fairmont_20260906/",
  "arkham_horror_lcg_eote_ursula_downs_20260906": "/games/ahlcg/eote_ursula_downs_20260906/",
  "arkham_horror_lcg_tcu_20260215": "/games/ahlcg/tcu_20260215/",
  "arkham_horror_lcg_tcu_harvey_walters_20260214": "/games/ahlcg/tcu_harvey_walters_20260214/",
  "arkham_horror_lcg_tcu_michael_mcglen_20260214": "/games/ahlcg/tcu_michael_mcglen_20260214/",
  "arkham_horror_lcg_tcu_wendy_adams_20260214": "/games/ahlcg/tcu_wendy_adams_20260214/",
  "arkham_horror_lcg_tde_20260503": "/games/ahlcg/tde_20260503/",
  "arkham_horror_lcg_tde_joe_diamond_20260508": "/games/ahlcg/tde_joe_diamond_20260508/",
  "arkham_horror_lcg_tde_kymani_jones_20260510": "/games/ahlcg/tde_kymani_jones_20260510/",
  "arkham_horror_lcg_tde_mandy_thompson_20260508": "/games/ahlcg/tde_mandy_thompson_20260508/",
  "arkham_horror_lcg_tde_silas_marsh_20260508": "/games/ahlcg/tde_silas_marsh_20260508/",
  "arkham_horror_lcg_tde_wilson_richards_20260503": "/games/ahlcg/tde_wilson_richards_20260503/",
  "arkham_horror_lcg_tde_zoey_samaras_20260508": "/games/ahlcg/tde_zoey_samaras_20260508/",
  "arkham_horror_lcg_tic_20260606": "/games/ahlcg/tic_20260606/",
  "arkham_horror_lcg_tic_george_barnaby_20260606": "/games/ahlcg/tic_george_barnaby_20260606/",
  "arkham_horror_lcg_tic_lily_chen_20260606": "/games/ahlcg/tic_lily_chen_20260606/",
  "arkham_horror_lcg_tic_trish_scarborough_20260606": "/games/ahlcg/tic_trish_scarborough_20260606/",
  "tainted_grail_foa": "/games/tg_foa/"
};
  const path = window.location.pathname.replace(/^\//, "").replace(/(?:\/index\.html|\.html|\/)?$/, "");
  const target = routes[path];
  if (target) window.location.replace(target + window.location.search + window.location.hash);
})();
