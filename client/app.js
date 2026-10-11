import { acceptInvite, handleAuthCallback, hydrateSession, updateUser } from "@netlify/identity";

function showStatus(form, message, error = false) {
  const status = form.querySelector(".form-status");
  if (!status) return;
  status.textContent = message;
  status.className = `form-status ${error ? "error" : "success"}`;
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.dataset.api) return;
  event.preventDefault();
  const buttons = [...form.querySelectorAll("button")];
  const disabledStates = buttons.map((button) => button.disabled);
  buttons.forEach((button) => { button.disabled = true; });
  form.setAttribute("aria-busy", "true");
  showStatus(form, "Envoi en cours…");
  try {
    const response = await fetch(form.dataset.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) {
      showStatus(form, result.error || "La demande n’a pas pu être enregistrée.", true);
      return;
    }
    showStatus(form, result.message || "Informations enregistrées.");
    const redirect = "redirect" in result ? result.redirect : form.dataset.redirect;
    if (typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")) {
      window.location.assign(redirect);
    } else if ("reload" in form.dataset) {
      window.location.reload();
    } else if (form.dataset.api === "/api/applications") {
      form.querySelector('button[type="submit"], button:not([type])').disabled = true;
      disabledStates.fill(true);
    }
  } catch {
    showStatus(form, "Connexion interrompue ou service indisponible. Vérifiez votre connexion et réessayez.", true);
  } finally {
    buttons.forEach((button, index) => { button.disabled = disabledStates[index]; });
    form.removeAttribute("aria-busy");
  }
});

async function callback() {
  try {
    const result = await handleAuthCallback();
    if (!result) {
      if (["/compte", "/connexion"].includes(window.location.pathname)) await hydrateSession();
      return;
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (result.type === "recovery" || result.type === "invite") {
      const main = document.querySelector("main");
      main.innerHTML = '<div class="wrap"><section class="card form-card"><h1>Définir mon mot de passe</h1><form id="new-password"><label for="new-password-field">Nouveau mot de passe (12 caractères minimum)</label><input id="new-password-field" name="password" type="password" required minlength="12" maxlength="200" autocomplete="new-password"><button class="btn" style="margin-top:16px">Enregistrer</button><p class="form-status" role="status" aria-live="polite"></p></form></section></div>';
      document.title = "Définir mon mot de passe — Wutligey";
      const robots = document.querySelector('meta[name="robots"]') || document.createElement("meta");
      robots.name = "robots";
      robots.content = "noindex, nofollow";
      document.head.append(robots);
      const form = document.querySelector("#new-password");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        try {
          const password = new FormData(form).get("password");
          if (result.type === "invite") await acceptInvite(result.token, password);
          else await updateUser({ password });
          window.location.assign("/compte");
        } catch {
          showStatus(form, "Impossible de modifier le mot de passe. Vérifiez le lien reçu par e-mail et réessayez.", true);
          button.disabled = false;
        }
      });
    } else {
      window.location.assign("/compte");
    }
  } catch {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const status = document.createElement("p");
    status.className = "notice";
    status.setAttribute("role", "alert");
    status.textContent = "Le lien de confirmation ou de récupération est invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.";
    document.querySelector("main").prepend(status);
  }
}

callback();
