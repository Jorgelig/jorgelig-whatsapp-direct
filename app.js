
/***************************************/
/*******       Dependencies      *******/
/***************************************/
const express = require('express');
const useragent = require('express-useragent');
const axios = require('axios');
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
const { GA_TRACKING_ID,SENTRY_DNS, ENV,  } = process.env;


const app = express();
Sentry.init({
  dsn: SENTRY_DNS,
  environment: ENV,
  debug: true,
  attachStacktrace: true,
  beforeSend(event) {
    console.log(event);
    return event;
},
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Tracing.Integrations.Express({ app }),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

const port = process.env.PORT || 3000;
const trackEvent = async (category, action, label, value) => {

  const data = {
    // API Version.
    v: '1',
    // Tracking ID / Property ID.
    tid: GA_TRACKING_ID,
    // Anonymous Client Identifier. Ideally, this should be a UUID that
    // is associated with particular user, device, or browser instance.
    cid: '555',
    // Event hit type.
    t: 'event',
    // Event category.
    ec: category,
    // Event action.
    ea: action,
    // Event label.
    el: label,
    // Event value.
    ev: value,
  };
  // console.log("Sending data to GA: ", data);

  return await axios.post('http://www.google-analytics.com/debug/collect', {
    params: data,
  });

};

/***************************************/
/*******         Router          *******/
/***************************************/
// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

app.use(Sentry.Handlers.errorHandler());
// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});
/*
 * http://<domain>
 * Desciption: Main page
 */
app.get('/', (req, res) => {

  var data = {
    status: "success",
    message: "OK"
  }
  res.status(200).json(data);
})

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("Sentry error!");
});

/*
 * http://<domain>/:phonenum
 * Desciption: Redirect url to respective whatsapp api interface without message text
 */
app.get('/:phonenum', async (req, res, next) => {

  var source = req.header('user-agent');
  var ua = useragent.parse(source);

  try {
    await trackEvent(
      'Redirect',
      'Phone',
      req.query.phonenum,
      ua
    );
    // res.status(200).send('Event tracked.').end();
  } catch (error) {
    // This sample treats an event tracking error as a fatal error. Depending
    // on your application's needs, failing to track an event may not be
    // considered an error.
    // next(error);
    console.log(error);
  } finally {
    if (ua.isDesktop) {
      res.status(308).redirect(`https://web.whatsapp.com/send?phone=+${req.query.phonenum}`);
    } else if (ua.isMobile) {
      res.status(308).redirect(`whatsapp://send?phone=+${req.query.phonenum}`);
    } else {
      res.status(400).json({ status: "error" });
    }
  }


})

/*
 * http://<domain>/:phonenum/:message
 * Desciption: Redirect url to respective whatsapp api interface with message text
 */
app.get('/:phonenum/:message', async (req, res, next) => {

  var source = req.header('user-agent');
  var ua = useragent.parse(source);
  console.log(req.params)
  console.log(req.query)

  try {
    const trackEvent = await trackEvent(
      'Redirect',
      'Message',
      req.params.phonenum,
      ua
    );

    console.log(trackEvent);
    // res.status(200).send('Event tracked.').end();
  } catch (error) {
    // This sample treats an event tracking error as a fatal error. Depending
    // on your application's needs, failing to track an event may not be
    // considered an error.
    // next(error);
    console.log(error);
    Sentry.captureException(error);
  } finally {
    if (ua.isDesktop) {
      const url = `https://web.whatsapp.com/send?phone=+${req.params.phonenum}&text=${req.params.message}`;
      console.log("redirect to: ", url);
      res.status(308).redirect(url);
    } else if (ua.isMobile) {
      const url = `whatsapp://send?phone=+${req.params.phonenum}&text=${req.params.message}`;
      console.log("redirect to: ", url);

      res.status(308).redirect(url);
    } else {
      res.status(400).json({ status: "error" });
    }
  }



})


// Start server at <port>
app.listen(port, (err) => {
  console.log(`Available at http://localhost:${port}`);
  if (err) {
    console.log(err);
  }
})