import { sanitizeUrl } from "@braintree/sanitize-url";
import normalizeUrl from "normalize-url";
import validator from 'validator';
import { UserError } from "./classes.mjs";

export function genEnding(length) {
        let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    	let str = '';
    	for (let i = 0; i < length; i++) {
        	str += chars.charAt(Math.floor(Math.random() * chars.length));
    	}
    	return str;
}
export async function newUrl(client, url, ending) {
  client.set(ending, url, (err, reply) => {
    if (err) throw err;

    client.get(ending, (err, reply) => {
        if (err) throw err;
    });
  }); 
}
export async function prepUrl(url) {
  url = sanitizeUrl(url)
  if (validator.isURL(url) == false || url == "about:blank") {
    return Promise.reject(new UserError("Invalid URL"))
  }
  url = normalizeUrl(url)
  return url;
}
