# L2G — textes FR et EN (annexe de `l2g/modele.md`)
> `architecte`, 2026-11-11. Fait partie du modèle. Textes neufs **à relire par le fondateur avant `production`** (`21` §5.8, D48) ; sans lien, chiffre, identifiant de réseau ni légende (D69, RG158). Format : clé — FR · EN. Les messages de RG96 sont ceux de `07` l. 861-870, traduits.

## 1. `apps/api/src/locales/{fr,en}/email.json` — `email.creatorProfileDecision`
- `published.subject` — Votre profil créateur INFLUX est publié · Your INFLUX creator profile is published
- `published.preheader` — Un commercial INFLUX a relu et publié votre profil. · An INFLUX sales representative reviewed and published your profile.
- `published.title` — Votre profil est publié · Your profile is published
- `published.body` — Un commercial INFLUX a relu votre profil et l'a publié. Seule sa version anonyme, sous votre alias, peut être présentée aux marques. · An INFLUX sales representative reviewed your profile and published it. Only its anonymous version, under your alias, can be shown to brands.
- `published.edit` — Si vous modifiez ensuite votre titre, votre bio, une légende, un visuel, un réseau, un pseudo ou un lien, la modification sera relue avant d'être publiée ; en attendant, la version publiée reste en place. Vos chiffres, thématiques et disponibilités changent aussitôt. · If you later change your headline, bio, a caption, a visual, a network, a handle or a link, the change will be reviewed before it is published; meanwhile, the published version stays in place. Your figures, topics and availability change at once.
- `rejected.subject` — Votre profil créateur INFLUX n'a pas été publié · Your INFLUX creator profile was not published
- `rejected.title` — Votre profil n'a pas été publié · Your profile was not published
- `rejected.body` — Un commercial INFLUX a relu votre profil et ne l'a pas publié en l'état. · An INFLUX sales representative reviewed your profile and did not publish it as it stands.
- `revisionApproved.subject` — Votre modification de profil INFLUX est publiée · Your INFLUX profile change is published
- `revisionApproved.body` — Un commercial INFLUX a relu votre modification et l'a publiée. · An INFLUX sales representative reviewed your change and published it.
- `revisionRejected.subject` — Votre modification de profil INFLUX n'a pas été publiée · Your INFLUX profile change was not published
- `revisionRejected.body` — Un commercial INFLUX a relu votre modification et ne l'a pas publiée. Votre profil reste visible dans sa version précédente. · An INFLUX sales representative reviewed your change and did not publish it. Your profile stays visible in its previous version.
- `why` — votre profil créateur a été relu par un commercial INFLUX · your creator profile was reviewed by an INFLUX sales representative
- `nextStep.fix` — Corrigez-le depuis votre espace INFLUX : votre correction sera relue à son tour. · Correct it from your INFLUX space: your correction will be reviewed in turn.
- `nextStep.contact` — Pour en discuter, contactez INFLUX depuis l'aide de l'écran de connexion. · To discuss it, contact INFLUX from the help on the sign-in screen.

`reason.<code>` (étape suivante : colonne `next_step`) :
- `identifier_in_text` — Votre titre ou votre bio contient un pseudo, un @, un lien ou un nom. Ces informations ne sont visibles qu'une fois la mise en relation ouverte. · Your headline or bio contains a handle, an @, a link or a name. This information is only visible once an introduction is opened.
- `bio_insufficient` — Votre bio ne permet pas à une marque de comprendre ce que vous faites. · Your bio does not let a brand understand what you do.
- `portfolio_insufficient` — Il faut au moins 3 éléments déposés pour publier votre profil. · At least 3 uploaded items are needed to publish your profile.
- `portfolio_non_compliant` — Un ou plusieurs de vos visuels permettent de vous identifier. · One or more of your visuals make it possible to identify you.
- `network_link_inconsistent` — Le lien déclaré ne correspond pas au réseau choisi. · The link you entered does not match the network you chose.
- `figures_inconsistent` — Les chiffres déclarés ne sont pas cohérents entre eux. · The figures you entered are not consistent with each other.
- `topic_inconsistent` — La thématique déclarée ne correspond pas au contenu montré. · The topic you chose does not match the content you show.
- `illicit_content` — Le contenu de votre profil ne peut pas être publié : il est contraire à la loi ou aux conditions d'utilisation d'INFLUX. · The content of your profile cannot be published: it goes against the law or INFLUX's terms of use.
- `age_doubt` — INFLUX est réservé aux personnes majeures : nous ne pouvons pas publier votre profil en l'état. · INFLUX is for adults only: we cannot publish your profile as it stands.
- `other` — Le message de l'équipe INFLUX : · The message from the INFLUX team:

## 2. `email.portfolioDecision` (paramètre `{date}` : jour du dépôt, format de la langue)
- `approved.subject` — Votre visuel INFLUX est approuvé · Your INFLUX visual is approved
- `approved.body` — Un commercial INFLUX a approuvé le visuel que vous avez déposé le {date}. Il fait désormais partie de la version anonyme de votre profil. · An INFLUX sales representative approved the visual you uploaded on {date}. It is now part of the anonymous version of your profile.
- `approved.replacement` — Il remplace le visuel précédent, retiré de votre profil. · It replaces the previous visual, removed from your profile.
- `rejected.subject` — Votre visuel INFLUX n'a pas été approuvé · Your INFLUX visual was not approved
- `rejected.body` — Un commercial INFLUX n'a pas approuvé le visuel que vous avez déposé le {date}. · An INFLUX sales representative did not approve the visual you uploaded on {date}.
- `rejected.replacement` — Le visuel précédent reste en place. · The previous visual stays in place.
- `rejected.nextStep` — Vous pouvez déposer un autre visuel depuis votre espace INFLUX. Le fichier refusé sera supprimé dans {days} jours. · You can upload another visual from your INFLUX space. The rejected file will be deleted in {days} days.
- `why` — un visuel de votre portfolio a été relu par un commercial INFLUX · a visual of your portfolio was reviewed by an INFLUX sales representative

`reason.<code>` (grille `07` RG79, puis RG82, RG83) :
- `watermark` — Le visuel porte un filigrane, une signature ou un logo personnel. · The visual carries a watermark, a signature or a personal logo.
- `handle_in_image` — Le visuel montre un @, un nom de compte ou un pseudo. · The visual shows an @, an account name or a handle.
- `app_interface` — Le visuel montre l'interface d'une application : bandeau de profil, avatar ou commentaires. · The visual shows an app interface: profile banner, avatar or comments.
- `text_naming_account_or_brand` — Un texte du visuel cite votre compte, ou une marque sans votre déclaration d'autorisation. · Text in the visual names your account, or a brand without your authorisation statement.
- `identifiable_place` — Le visuel permet de reconnaître un lieu : enseigne, plaque d'immatriculation, numéro de rue ou lieu connu. · The visual makes a place recognisable: a shop sign, a number plate, a street number or a known location.
- `statistics_screenshot` — Une capture de statistiques n'est pas admise au portfolio : elle montre votre pseudo. · A statistics screenshot is not allowed in the portfolio: it shows your handle.
- `illicit_content` — Le visuel est contraire à la loi ou aux conditions d'utilisation d'INFLUX. · The visual goes against the law or INFLUX's terms of use.
- `caption_identifier` — La légende contient un pseudo, un @, un lien ou un nom. · The caption contains a handle, an @, a link or a name.
- `caption_brand_unauthorised` — La légende cite une marque sans que vous ayez déclaré y être autorisé. · The caption names a brand without your statement that you are allowed to.

## 3. `apps/web/src/locales/{fr,en}/creator-profile.json` (`creatorProfile.`)
Reprises de `07` l. 972-994 sans changement : `publish.missing`, `portfolio.notice`, `portfolio.pending`, `portfolio.brandConsent`, `visibility.off`, `status.pendingWithPublished`, `status.rejected`, `errors.identifierInText`. Motifs affichés : `rejection.<code>` et `portfolio.reason.<code>` = textes des §1 et §2.
- `state.draft` (L2DU-15) — En cours de saisie · In progress
- `required.portfolio` — au moins 3 visuels déposés · at least 3 uploaded visuals
- `required.accountVerified` — un compte vérifié par INFLUX · an account verified by INFLUX
- `portfolio.faceNotice` (RG79 contrôle 6, D79 (5)) — Un visage est admis, mais il peut permettre de vous retrouver par une recherche d'image. · A face is allowed, but it can let someone find you through an image search.
- `portfolio.approved` — Approuvé · Approved
- `portfolio.rejected` — Refusé : {reason} · Rejected: {reason}
- `portfolio.replacementPending` — Remplacement en cours de modération : le visuel actuel reste affiché. · Replacement being reviewed: the current visual stays shown.
- `portfolio.captionPending` — Légende en cours de validation : la précédente reste affichée. · Caption being reviewed: the previous one stays shown.
- `portfolio.count` — {count} visuels déposés sur 8 · {count} of 8 visuals uploaded
- `portfolio.full` — Vous avez déposé 8 visuels, le maximum : remplacez-en un pour en changer. · You have uploaded 8 visuals, the maximum: replace one to change it.
- `portfolio.minimum` — Un profil publié garde au moins 3 visuels : remplacez celui-ci plutôt que de le retirer. · A published profile keeps at least 3 visuals: replace this one rather than removing it.
- `portfolio.caption` — Légende (facultative, 200 caractères au plus) · Caption (optional, 200 characters at most)
- `publish.action` — Publier mon profil · Publish my profile
- `publish.submitted` (`17` l. 1393) — Profil soumis à validation. Réponse sous 1 jour ouvré. · Profile submitted for review. Answer within 1 business day.
- `visibility.label` — Visible dans la recherche · Visible in search
- `preview.title` — Ce que voit une marque · What a brand sees
- `preview.before` — Avant la mise en relation · Before an introduction
- `preview.after` — Après la mise en relation · After an introduction
- `preview.explain` — Exactement ce que la plateforme sert à une marque, rien de plus. · Exactly what the platform serves a brand, nothing more.

## 4. Backoffice (français seul, D36)
- `queue.profiles_creator` — Profils créateur à valider ; `queue.portfolio_moderation` — Visuels de portfolio à modérer.
- `field.creator.` + `headline` Titre court · `bio` Bio · `portfolio_caption` Légende · `network_line` Réseau ajouté · `network_handle` Pseudo · `network_url` Lien du profil.
- `reason.profiles_creator.` + `identifier_in_text` Élément identifiant dans un texte · `bio_insufficient` Bio trop courte ou incompréhensible · `portfolio_insufficient` Portfolio insuffisant · `portfolio_non_compliant` Portfolio non conforme · `network_link_inconsistent` Handle ou lien incohérent · `figures_inconsistent` Chiffres manifestement incohérents · `topic_inconsistent` Thématique manifestement incohérente · `illicit_content` Contenu illicite ou contraire aux CGU · `age_doubt` Doute sur la majorité · `other` Autre.
- `reason.portfolio_moderation.` + `watermark` 1 · Filigrane, signature, logo personnel · `handle_in_image` 2 · @, nom de compte, pseudo incrusté · `app_interface` 3 · Interface d'application visible · `text_naming_account_or_brand` 4 · Texte citant le compte ou une marque sans autorisation · `identifiable_place` 5 · Enseigne, plaque, numéro de rue, lieu reconnaissable · `statistics_screenshot` 7 · Capture de statistiques · `illicit_content` 9 · Contenu illicite ou contraire aux CGU · `caption_identifier` Légende : élément identifiant · `caption_brand_unauthorised` Légende : marque citée sans autorisation.
- `bo.queue.portfolio.faceRule` — 6 · Visage : admis ; refus seulement s'il s'ajoute un autre contrôle de la grille.
- `bo.queue.portfolio.exifRule` — 8 · Métadonnées : supprimées au dépôt, avant toute modération.
- `bo.account.creator.rates` (③, D78) — Aucun tarif saisi : les coûts se négocient avec le commercial.
- `bo.account.creator.unlisted` — Réseau ajouté, en attente de validation.
