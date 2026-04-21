import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const app = express();
const port = Number(process.env.MAIL_API_PORT ?? 8787);
const allowedOrigin = process.env.MAIL_API_ALLOWED_ORIGIN ?? "http://localhost:5173";
const allowedOrigins = allowedOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigin === "*" ? true : allowedOrigins,
  }),
);
app.use(express.json({ limit: "1mb" }));
const sessions = new Map();

const folderMap = {
  inbox: process.env.MAIL_FOLDER_INBOX ?? "INBOX",
  starred: process.env.MAIL_FOLDER_INBOX ?? "INBOX",
  important: process.env.MAIL_FOLDER_INBOX ?? "INBOX",
  archive: process.env.MAIL_FOLDER_ARCHIVE ?? "Archive",
  drafts: process.env.MAIL_FOLDER_DRAFTS ?? "Drafts",
  sent: process.env.MAIL_FOLDER_SENT ?? "Sent",
  spam: process.env.MAIL_FOLDER_SPAM ?? "Spam",
  trash: process.env.MAIL_FOLDER_TRASH ?? "Trash",
};

function getAuthFromRequest(request) {
  const header = request.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const session = sessions.get(token);

  if (!session) {
    const error = new Error("Login required.");
    error.status = 401;
    throw error;
  }

  return { token, session };
}

function getImapClient(session) {
  return new ImapFlow({
    host: process.env.MAIL_IMAP_HOST ?? "imap.ionos.com",
    port: Number(process.env.MAIL_IMAP_PORT ?? 993),
    secure: (process.env.MAIL_IMAP_SECURE ?? "true") === "true",
    auth: {
      user: session.email,
      pass: session.password,
    },
    logger: false,
  });
}

function getTransporter(session) {
  return nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOST ?? "smtp.ionos.com",
    port: Number(process.env.MAIL_SMTP_PORT ?? 465),
    secure: (process.env.MAIL_SMTP_SECURE ?? "true") === "true",
    auth: {
      user: session.email,
      pass: session.password,
    },
  });
}

function encodeId(folder, uid) {
  return Buffer.from(JSON.stringify({ folder, uid })).toString("base64url");
}

function decodeId(id) {
  return JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
}

function normalizeAddress(addresses) {
  const first = addresses?.value?.[0];
  return {
    name: first?.name || first?.address || "Unknown sender",
    address: first?.address || "",
  };
}

function formatReceivedAt(date) {
  if (!date) return "";
  const messageDate = new Date(date);
  const now = new Date();
  const isToday = messageDate.toDateString() === now.toDateString();

  if (isToday) {
    return messageDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return messageDate.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function readMessages(session, view = "inbox", limit = 50) {
  const folder = folderMap[view] ?? folderMap.inbox;
  const client = getImapClient(session);

  await client.connect();
  const lock = await client.getMailboxLock(folder);

  try {
    const mailbox = client.mailbox;
    const total = mailbox?.exists ?? 0;
    if (!total) return [];

    const start = Math.max(1, total - limit + 1);
    const messages = [];

    for await (const message of client.fetch(`${start}:*`, {
      uid: true,
      flags: true,
      envelope: true,
      source: true,
    })) {
      const parsed = await simpleParser(message.source);
      const from = normalizeAddress(parsed.from);
      const text = parsed.text?.trim() || parsed.html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
      const body = text ? text.split(/\n{2,}/).slice(0, 8) : [parsed.subject || "No message body."];
      const flags = Array.from(message.flags ?? []);

      messages.push({
        id: encodeId(folder, message.uid),
        uid: message.uid,
        folder: view === "archive" ? "archive" : "inbox",
        mailboxFolder: folder,
        from: from.name,
        fromAddress: from.address,
        subject: parsed.subject || "No subject",
        preview: text.slice(0, 180),
        body,
        receivedAt: formatReceivedAt(parsed.date),
        unread: !flags.includes("\\Seen"),
        starred: flags.includes("\\Flagged"),
        important: parsed.headers.get("importance") === "high" || parsed.headers.get("x-priority") === "1",
        tags: [],
        hasAttachment: Boolean(parsed.attachments?.length),
      });
    }

    return messages.reverse();
  } finally {
    lock.release();
    await client.logout();
  }
}

async function withMessage(session, id, action) {
  const { folder, uid } = decodeId(id);
  const client = getImapClient(session);

  await client.connect();
  const lock = await client.getMailboxLock(folder);

  try {
    return await action(client, uid, folder);
  } finally {
    lock.release();
    await client.logout();
  }
}

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/login", async (request, response) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
      displayName: z.string().optional(),
    })
    .safeParse(request.body);

  if (!body.success) {
    response.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  const session = {
    email: body.data.email,
    password: body.data.password,
    displayName: body.data.displayName || body.data.email,
    createdAt: Date.now(),
  };
  const client = getImapClient(session);

  try {
    await client.connect();
    await client.logout();

    const token = crypto.randomUUID();
    sessions.set(token, session);
    response.json({ token, email: session.email, displayName: session.displayName });
  } catch (error) {
    response.status(401).json({ error: error.message || "Mailbox login failed." });
  }
});

app.get("/api/session", (request, response) => {
  try {
    const { session } = getAuthFromRequest(request);
    response.json({ email: session.email, displayName: session.displayName });
  } catch (error) {
    response.status(error.status ?? 401).json({ error: error.message });
  }
});

app.post("/api/logout", (request, response) => {
  try {
    const { token } = getAuthFromRequest(request);
    sessions.delete(token);
  } catch {
    // Logging out should be idempotent from the client's perspective.
  }

  response.json({ ok: true });
});

app.get("/api/messages", async (request, response) => {
  try {
    const { session } = getAuthFromRequest(request);
    const view = String(request.query.folder ?? "inbox");
    const limit = Math.min(Number(request.query.limit ?? 50), 100);
    const messages = await readMessages(session, view, limit);
    response.json({ messages });
  } catch (error) {
    response.status(error.status ?? 500).json({ error: error.message });
  }
});

app.patch("/api/messages/:id/seen", async (request, response) => {
  try {
    const { session } = getAuthFromRequest(request);
    const body = z.object({ seen: z.boolean() }).parse(request.body);
    await withMessage(session, request.params.id, (client, uid) =>
      body.seen
        ? client.messageFlagsAdd(uid, ["\\Seen"], { uid: true })
        : client.messageFlagsRemove(uid, ["\\Seen"], { uid: true }),
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(error.status ?? 500).json({ error: error.message });
  }
});

app.patch("/api/messages/:id/flagged", async (request, response) => {
  try {
    const { session } = getAuthFromRequest(request);
    const body = z.object({ flagged: z.boolean() }).parse(request.body);
    await withMessage(session, request.params.id, (client, uid) =>
      body.flagged
        ? client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true })
        : client.messageFlagsRemove(uid, ["\\Flagged"], { uid: true }),
    );
    response.json({ ok: true });
  } catch (error) {
    response.status(error.status ?? 500).json({ error: error.message });
  }
});

app.post("/api/messages/:id/archive", async (request, response) => {
  try {
    const { session } = getAuthFromRequest(request);
    await withMessage(session, request.params.id, (client, uid) => client.messageMove(uid, folderMap.archive, { uid: true }));
    response.json({ ok: true });
  } catch (error) {
    response.status(error.status ?? 500).json({ error: error.message });
  }
});

app.post("/api/messages/:id/trash", async (request, response) => {
  try {
    const { session } = getAuthFromRequest(request);
    await withMessage(session, request.params.id, (client, uid) => client.messageMove(uid, folderMap.trash, { uid: true }));
    response.json({ ok: true });
  } catch (error) {
    response.status(error.status ?? 500).json({ error: error.message });
  }
});

app.post("/api/send", async (request, response) => {
  try {
    const { session } = getAuthFromRequest(request);
    const body = z
      .object({
        to: z.string().min(3),
        subject: z.string().default(""),
        text: z.string().min(1),
      })
      .parse(request.body);
    const fromName = session.displayName ?? "Mail App";
    const fromAddress = session.email;
    const transporter = getTransporter(session);

    await transporter.sendMail({
      from: `${fromName} <${fromAddress}>`,
      to: body.to,
      subject: body.subject,
      text: body.text,
    });

    response.json({ ok: true });
  } catch (error) {
    response.status(error.status ?? 500).json({ error: error.message });
  }
});

const distPath = path.join(projectRoot, "dist");
app.use(express.static(distPath));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Mail API listening on http://localhost:${port}`);
});
