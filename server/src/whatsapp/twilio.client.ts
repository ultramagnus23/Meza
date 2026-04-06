import twilio from "twilio";

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    console.warn("Twilio credentials not configured");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body,
      from,
      to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown Twilio error";
    console.error("Twilio send error:", errMsg);
    return { success: false, error: errMsg };
  }
}
