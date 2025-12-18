import got from 'got';

interface PushoverRecipient {
  userKey: string;
  deviceName?: string | undefined;
}

interface PushoverMessage {
  title: string;
  content: string;
}

export default class PushoverClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async pushMessage(recipient: PushoverRecipient, message: PushoverMessage) {
    const endpoint = 'messages.json';
    const url = new URL(endpoint, this.baseUrl);

    const data: {
      token: string;
      user: string;
      device?: string;
      title: string;
      message: string;
    } = {
      token: this.apiKey,
      user: recipient.userKey,
      title: message.title,
      message: message.content,
    };

    if (recipient.deviceName) data.device = recipient.deviceName;

    await got.post(url, { form: data });
  }
}
