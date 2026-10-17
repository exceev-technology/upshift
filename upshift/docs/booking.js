// Mintlify loads every .js file of the site on every page. Links to the
// Upshift intro booking (Contact us, Book a demo) open it in a Cal.com pop-up
// instead of leaving the docs; until Cal.com's script has loaded, they open
// the booking page itself.
(function () {
  var ORIGIN = 'https://calcom.exceev.com';
  var CAL_LINK = 'team/exceev-technology/upshift-intro';
  var NAMESPACE = 'upshift-intro';
  var EMBED_URL = ORIGIN + '/embed/embed.js';
  var BOOKING_URL = ORIGIN + '/' + CAL_LINK;
  var BRAND_COLORS = { light: '#1A1BB5', dark: '#9192F0' };

  if (window.upshiftBooking) {
    return;
  }

  window.upshiftBooking = { ready: false };

  // Cal.com's loader snippet: queues calls until embed.js has loaded.
  (function (C, A, L) {
    var p = function (a, ar) {
      a.q.push(ar);
    };
    var d = C.document;
    C.Cal =
      C.Cal ||
      function () {
        var cal = C.Cal;
        var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () {
            p(api, arguments);
          };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else {
            p(cal, ar);
          }
          return;
        }
        p(cal, ar);
      };
  })(window, EMBED_URL, 'init');

  window.Cal('init', NAMESPACE, { origin: ORIGIN });
  window.Cal.ns[NAMESPACE]('ui', {
    cssVarsPerTheme: {
      light: { 'cal-brand': BRAND_COLORS.light },
      dark: { 'cal-brand': BRAND_COLORS.dark },
    },
    hideEventTypeDetails: false,
    layout: 'month_view',
  });

  var embedScript = document.querySelector('script[src="' + EMBED_URL + '"]');

  if (embedScript) {
    embedScript.addEventListener('load', function () {
      window.upshiftBooking.ready = true;
    });
  }

  document.addEventListener(
    'click',
    function (event) {
      var link =
        event.target instanceof Element
          ? event.target.closest('a[href^="' + BOOKING_URL + '"]')
          : null;
      var isPlainClick =
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey;

      if (!link || !isPlainClick || !window.upshiftBooking.ready) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      window.Cal.ns[NAMESPACE]('modal', {
        calLink: CAL_LINK,
        config: { layout: 'month_view', useSlotsViewOnSmallScreen: 'true' },
      });
    },
    true,
  );
})();
