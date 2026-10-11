import type { UserDeletedEvent, UserSignupEvent } from "@netlify/functions";
import { eq, inArray } from "drizzle-orm";
import { database } from "../../db/index.js";
import { applications, jobs, profiles } from "../../db/schema.js";
import { recruitmentAllowed } from "../../server/content.js";
import { siteSettings } from "../../server/data.js";
import { removeUnusedDocument } from "../../server/documents.js";

export default {
  async userSignup(event: UserSignupEvent) {
    const metadata = event.user.userMetadata ?? {};
    const invited = Boolean(event.user.invitedAt);
    try {
      if (!invited && (!recruitmentAllowed(await siteSettings(), event.user.email) || !["candidat", "recruteur"].includes(String(metadata.account_type)) || !metadata.terms_accepted_at)) {
        console.warn("identity_signup_denied_configuration_or_consent");
        return event.deny();
      }
      const accountType = event.user.appMetadata?.account_type ?? metadata.account_type;
      return { user: { ...event.user, appMetadata: { ...event.user.appMetadata, account_type: accountType === "recruteur" ? "recruteur" : "candidat" } } };
    } catch {
      console.error("identity_signup_configuration_unavailable");
      return event.deny();
    }
  },
  async userDeleted(event: UserDeletedEvent) {
    try {
      const keys = await database().transaction(async (transaction) => {
        const [profile] = await transaction.select().from(profiles).where(eq(profiles.id, event.user.id)).for("update");
        const owned = await transaction.select({ id: jobs.id }).from(jobs).where(eq(jobs.ownerId, event.user.id));
        const personal = await transaction.select({ cvKey: applications.cvKey }).from(applications).where(eq(applications.candidateId, event.user.id));
        const received = owned.length ? await transaction.select({ cvKey: applications.cvKey }).from(applications).where(inArray(applications.jobId, owned.map((job) => job.id))) : [];
        await transaction.delete(applications).where(eq(applications.candidateId, event.user.id));
        if (owned.length) await transaction.delete(applications).where(inArray(applications.jobId, owned.map((job) => job.id)));
        await transaction.delete(jobs).where(eq(jobs.ownerId, event.user.id));
        await transaction.delete(profiles).where(eq(profiles.id, event.user.id));
        return [...new Set([profile?.cvKey ?? "", ...personal.map((entry) => entry.cvKey), ...received.map((entry) => entry.cvKey)])];
      });
      await Promise.all(keys.filter(Boolean).map(removeUnusedDocument));
    } catch {
      throw new Error("La suppression des données du compte doit être réessayée.");
    }
  },
};
