interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessageMeta(
  to: string,
  body: string
): Promise<SendResult> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { success: false, error: "Meta WhatsApp not configured" };
  }

  // Clean phone number (remove whatsapp: prefix and +)
  const cleanPhone = to.replace("whatsapp:", "").replace("+", "");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const data = await response.json() as { messages?: Array<{ id: string }> };
    const msgId = data.messages?.[0]?.id;
    return { success: true, messageId: msgId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown Meta error";
    console.error("Meta WhatsApp send error:", errMsg);
    return { success: false, error: errMsg };
  }
}
