const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { MessagingResponse } = require("twilio").twiml;
const cors = require("cors")({ origin: true });

const TWILIO_SID = defineSecret("TWILIO_SID");
const TWILIO_TOKEN = defineSecret("TWILIO_TOKEN");
const TWILIO_FROM = defineSecret("TWILIO_FROM");

//primer ejemplo de mandar whats
exports.sendWhatsApp = onRequest(
  {
    region: "us-central1",
    secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {

        if (req.method === "OPTIONS") {
          res.status(204).send("");
          return;
        }

        if (req.method !== "POST") {
          res.status(405).json({ ok:false });
          return;
        }

        const { to, body } = req.body;

        const toFixed = to.startsWith("whatsapp:")
          ? to
          : `whatsapp:${to}`;

        const twilio = require("twilio")(
          TWILIO_SID.value(),
          TWILIO_TOKEN.value()
        );

        const msg = await twilio.messages.create({
          from: TWILIO_FROM.value(),
          to: toFixed,
          body
        });

        res.json({
          ok:true,
          sid: msg.sid
        });

      } catch (err) {

        res.status(500).json({
          ok:false,
          message: err.message,
          code: err.code
        });

      }
    });
  }
);

//primer ejemplo mandar mensaje de texto
const TWILIO_PHONE = defineSecret("TWILIO_PHONE");
exports.sendSMS = onRequest(
  {
    region: "us-central1",
    secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

        const { to, body } = req.body || {};
        if (!to || !body) return res.status(400).json({ ok: false, error: "Missing {to, body}" });

        const sid = TWILIO_SID.value();
        const tok = TWILIO_TOKEN.value();
        const from = TWILIO_PHONE.value();

        // debug seguro (no imprime token)
        console.log("SMS SID prefix:", sid?.slice(0, 2), "len:", sid?.length);
        console.log("SMS TOKEN len:", tok?.length);
        console.log("SMS FROM:", from);

        const client = require("twilio")(sid, tok);

        console.log("SMS payload:", { from, to, body });
        const msg = await client.messages.create({
          from,
          to,
          body,
        });

        return res.status(200).json({ ok: true, sid: msg.sid });
      } catch (err) {
        console.error("sendSMS error:", err);
        return res.status(500).json({
          ok: false,
          message: err.message,
          code: err.code,
          status: err.status,
        });
      }
    });
  }
);

/*
//segundo ejemplo de whats
const TWILIO_CONTENT_SID_PEDIDO_LISTO = defineSecret("TWILIO_CONTENT_SID_PEDIDO_LISTO");
exports.sendWhatsAppTemplate = onRequest(
  {
    region: "us-central1",
    secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, TWILIO_CONTENT_SID_PEDIDO_LISTO],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          res.status(204).send("");
          return;
        }

        if (req.method !== "POST") {
          res.status(405).json({ ok: false });
          return;
        }

        const { to, nombre, total } = req.body || {};

        if (!to || !nombre || !total) {
          res.status(400).json({
            ok: false,
            message: "Missing {to, nombre, total}",
          });
          return;
        }

        const toFixed = to.startsWith("whatsapp:")
          ? to
          : `whatsapp:${to}`;

        const twilio = require("twilio")(
          TWILIO_SID.value(),
          TWILIO_TOKEN.value()
        );

        const msg = await twilio.messages.create({
          from: TWILIO_FROM.value(),
          to: toFixed,
          contentSid: TWILIO_CONTENT_SID_PEDIDO_LISTO.value(),
          contentVariables: JSON.stringify({
            "1": String(nombre),
            "2": String(total),
          }),
        });

        res.json({
          ok: true,
          sid: msg.sid,
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          message: err.message,
          code: err.code,
        });
      }
    });
  }
);
*/

//envia template whats atraves de un servicio de mensaje
const TWILIO_CONTENT_SID_PEDIDO_LISTO = defineSecret("TWILIO_CONTENT_SID_PEDIDO_LISTO");
const TWILIO_MESSAGING_SERVICE_SID = defineSecret("TWILIO_MESSAGING_SERVICE_SID");
exports.sendWhatsAppTemplate = onRequest(
  {
    region: "us-central1",
    secrets: [
      TWILIO_SID,
      TWILIO_TOKEN,
      TWILIO_CONTENT_SID_PEDIDO_LISTO,
      TWILIO_MESSAGING_SERVICE_SID,
    ],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {

        if (req.method === "OPTIONS") {
          res.status(204).send("");
          return;
        }

        if (req.method !== "POST") {
          res.status(405).json({ ok: false });
          return;
        }

        const { to, nombre, total } = req.body || {};

        if (!to || !nombre || !total) {
          res.status(400).json({
            ok: false,
            message: "Missing {to, nombre, total}",
          });
          return;
        }

        const toFixed = to.startsWith("whatsapp:")
          ? to
          : `whatsapp:${to}`;

        const twilio = require("twilio")(
          TWILIO_SID.value(),
          TWILIO_TOKEN.value()
        );

        const msg = await twilio.messages.create({
          messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID.value(),
          to: toFixed,
          contentSid: TWILIO_CONTENT_SID_PEDIDO_LISTO.value(),
          contentVariables: JSON.stringify({
            "1": String(nombre),
            "2": String(total),
          }),
        });

        res.json({
          ok: true,
          sid: msg.sid,
        });

      } catch (err) {

        res.status(500).json({
          ok: false,
          message: err.message,
          code: err.code,
        });

      }
    });
  }
);

exports.incomingWhatsApp = onRequest(
  {
    region: "us-central1",
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          res.status(204).send("");
          return;
        }

        const twiml = new MessagingResponse();

        twiml.message(`Hola 👋

Este número solo envía notificaciones.

Para hacer tu pedido escríbenos aquí:
https://wa.me/523335050537`);

        res.type("text/xml");
        res.send(twiml.toString());
      } catch (err) {
        console.error("incomingWhatsApp error:", err);
        res.status(500).send("Internal Server Error");
      }
    });
  }
);