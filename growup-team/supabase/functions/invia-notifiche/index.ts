// Growup Team — Edge Function «invia-notifiche» (039).
// Due ingressi:
//  * dal pianificatore (pg_cron, ogni 15 minuti) con l'intestazione x-growup-cron: invia quello che il database dice
//    (notifiche_da_inviare), segna gli invii (notifiche_segna) e toglie i telefoni non più validi;
//  * dall'app, «Manda una notifica di prova», con il token di chi è entrato: solo ai suoi telefoni (letti con i suoi
//    permessi, RLS).
// Le chiavi VAPID le genera questa funzione la prima volta e le custodisce nel database (notifiche_chiavi, nessun
// permesso per gli utenti). La chiave service_role la dà Supabase all'ambiente della funzione: non sta nel codice.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVIZIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SOGGETTO = "https://cl21-aes.github.io/growup-team/";
const CORS = {
  "Access-Control-Allow-Origin": "https://cl21-aes.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const risposta = (dati: unknown, stato = 200) =>
  new Response(JSON.stringify(dati), { status: stato, headers: { ...CORS, "Content-Type": "application/json" } });

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const daB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));

async function chiavi(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from("notifiche_chiavi").select("pubblica, privata").eq("id", 1).maybeSingle();
  if (data) return data as { pubblica: string; privata: string };
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", k.privateKey);
  const pubblica = b64url(new Uint8Array([4, ...daB64url(jwk.x!), ...daB64url(jwk.y!)]));
  const nuove = { id: 1, pubblica, privata: jwk.d! };
  const { error } = await sb.from("notifiche_chiavi").insert(nuove);
  if (error) {  // un'altra esecuzione le ha appena create: si usano quelle
    const { data: ora } = await sb.from("notifiche_chiavi").select("pubblica, privata").eq("id", 1).single();
    return ora as { pubblica: string; privata: string };
  }
  return nuove;
}

type Riga = { telefono_id: string; partner_id: string; chiave: string; endpoint: string; p256dh: string; auth: string;
  titolo: string; corpo: string; url: string };

async function invia(sb: ReturnType<typeof createClient>, righe: Riga[], segna: boolean) {
  const k = await chiavi(sb);
  webpush.setVapidDetails(SOGGETTO, k.pubblica, k.privata);
  let ok = 0;
  const fatte = new Set<string>();
  for (const r of righe) {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify({ titolo: r.titolo, corpo: r.corpo, url: r.url, tag: r.chiave }), { TTL: 6 * 3600, urgency: "normal" });
      ok++;
      if (segna) fatte.add(r.partner_id + "|" + r.chiave);
    } catch (e) {
      const stato = (e as { statusCode?: number }).statusCode;
      if (stato === 404 || stato === 410) await sb.from("notifiche_telefoni").delete().eq("id", r.telefono_id);
      else await sb.from("notifiche_telefoni").update({ ultimo_errore: String(stato || e).slice(0, 200) }).eq("id", r.telefono_id);
    }
  }
  for (const x of fatte) {
    const [p, c] = x.split("|");
    await sb.rpc("notifiche_segna", { p_partner: p, p_chiave: c });
  }
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return risposta({ errore: "metodo" }, 405);
  const servizio = createClient(URL_SB, SERVIZIO, { auth: { persistSession: false } });

  // dal pianificatore
  const segreto = req.headers.get("x-growup-cron");
  if (segreto) {
    const { data: giusto } = await servizio.rpc("notifiche_segreto_ok", { p_segreto: segreto });
    if (!giusto) return risposta({ errore: "non autorizzato" }, 401);
    await chiavi(servizio);  // la prima volta crea le chiavi, così l'app può iscriversi
    const { data, error } = await servizio.rpc("notifiche_da_inviare", { p_ora: new Date().toISOString() });
    if (error) return risposta({ errore: error.message }, 500);
    const inviate = await invia(servizio, (data || []) as Riga[], true);
    return risposta({ inviate });
  }

  // la prova dal Profilo: solo ai propri telefoni
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return risposta({ errore: "non autorizzato" }, 401);
  const utente = createClient(URL_SB, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + token } } });
  const { data: telefoni, error } = await utente.from("notifiche_telefoni").select("id, partner_id, endpoint, p256dh, auth");
  if (error) return risposta({ errore: "non autorizzato" }, 401);
  if (!telefoni || !telefoni.length) return risposta({ inviate: 0 });
  const righe = telefoni.map(t => ({ telefono_id: t.id, partner_id: t.partner_id, chiave: "prova", endpoint: t.endpoint,
    p256dh: t.p256dh, auth: t.auth, titolo: "Growup", corpo: "Le notifiche funzionano: ogni mattina alle 8:30 ti diciamo cosa c'è da fare.", url: "./" }));
  return risposta({ inviate: await invia(servizio, righe, false) });
});
