import got from 'got';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { enrolementsSchema, pdfResponseSchema, type Enrolement } from './schemas.js';

import type { Got } from 'got';
import type { Response } from 'got';

interface LoginCredentials {
  username: string;
  password: string;
}

export default class SIMClient {
  private readonly PDF_SERVICE_PATH =
    'sap/opu/odata/sap/YSLCM_BESCHEINIGUNGEN_SRV/LeistungsuebersichtSet';

  private client: Got;
  private jar: CookieJar;

  constructor(
    private baseUrl: string | URL,
    private credentials: LoginCredentials
  ) {
    this.jar = new CookieJar();

    this.client = got.extend({
      cookieJar: this.jar,
    });
  }

  async authenticate() {
    let response = await this.client.get(this.baseUrl);

    //Send SAML2 request
    response = await this.autoSubmitForm(response);

    //Redirect to session information page
    response = await this.perform302Redirect(response);

    //Press "continue" on the site about session information
    response = await this.autoSubmitForm(response);

    //Redirect to login page
    response = await this.perform302Redirect(response);

    //Enter credentials and submit the form
    response = await this.performLogin(response);

    //Send SAML2 response back to the service
    response = await this.autoSubmitForm(response);
    response = await this.autoSubmitForm(response);
  }

  private toUrl(uri: string, baseUrl: string | URL) {
    return new URL(uri, baseUrl);
  }

  private extractRequestUrl($form: cheerio.Cheerio<any>): string | undefined {
    return $form.attr('action');
  }

  private extractRequestBody($form: cheerio.Cheerio<any>): string {
    const body = new URLSearchParams();

    $form.find('input').each((_, element) => {
      const name = element.attribs['name'];
      const value = element.attribs['value'];

      if (name) body.append(name, value || '');
    });

    return body.toString();
  }

  private submitForm($form: cheerio.Cheerio<any>, baseUrl: string | URL) {
    const extractedUri = this.extractRequestUrl($form);

    if (!extractedUri)
      throw new Error('The provided form does not contain an uri.');

    const url = this.toUrl(extractedUri, baseUrl);
    const body = this.extractRequestBody($form);

    return this.client.post(url, {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      followRedirect: false,
    });
  }

  private loadForm(response: Response<any>) {
    const $ = cheerio.load(response.body);
    const $form = $('form');

    if ($form.length != 1) {
      throw new Error(`Response does not contain exactly one form.`);
    }

    return $form;
  }

  private autoSubmitForm(response: Response<string>) {
    return this.submitForm(this.loadForm(response), response.requestUrl);
  }

  private perform302Redirect(response: Response<string>) {
    if (response.statusCode !== 302 || !response.headers.location)
      throw new Error('The response does not contain a valid 302 redirect.');

    const destination = this.toUrl(
      response.headers.location,
      response.requestUrl
    );
    return this.client.get(destination);
  }

  private wasLoginSuccessfull(response: Response<string>) {
    return response.statusCode !== 302;
  }

  private async performLogin(response: Response<string>) {
    const $form = this.loadForm(response);

    $form.find('input[id=username]').attr('value', this.credentials.username);
    $form.find('input[id=password]').attr('value', this.credentials.password);

    $form.append('<input type="hidden" name="_eventId_proceed" value="">');

    const loginResponse = await this.submitForm($form, response.requestUrl);

    if(!this.wasLoginSuccessfull(loginResponse))
      throw new Error('Invalid login credentials.');

    return loginResponse;
  }

  async fetchEnrolements(): Promise<Enrolement[]> {
    const url = new URL(this.PDF_SERVICE_PATH, this.baseUrl);

    const response = await this.client.get(url, {
      searchParams: {
        'sap-client': '400',
        $format: 'json',
      },
      responseType: 'json',
      resolveBodyOnly: true,
    });

    return enrolementsSchema.parse(response);
  }

  async fetchPdf(enrolement: Enrolement) {
    const entityKeys = [
      `Studentnumber='${enrolement.studentNumber}'`,
      `Studiengang_ID='${enrolement.majorId}'`,
      `Sprache='${enrolement.languageCode}'`,
      `Studiengaenge='${encodeURIComponent(enrolement.majorName)}'`,
    ].join(',');

    const relativePathWithKeys = `${this.PDF_SERVICE_PATH}(${entityKeys})`;

    const url = new URL(relativePathWithKeys, this.baseUrl);

    const response = await this.client.get(url, {
      searchParams: {
        'sap-client': '400',
        $format: 'json',
      },
      responseType: 'json',
      resolveBodyOnly: true,
    });

    const base64String = pdfResponseSchema.parse(response);

    return base64String;
  }

  async clearCookies() {
    this.jar.removeAllCookies();
  }
}
