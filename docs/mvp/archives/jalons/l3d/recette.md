# L3D-F — recette `staging` du fondateur
Type `fondateur` : arrêt. **Préalable :** lignes 01 à 05 `fait`, CI verte, « Migrate staging » vert.
**Préparation par l'agent (D70, SQL de données sur `staging`, rien en production) :** un créateur
synthétique publié (`signup_utm_source = 'seed-fake-profiles'`) qui refuse un secteur ; trois
campagnes publiées de marques synthétiques, dont une de ce secteur et une dont le profil marque est
mis `suspended` pour la recette, remis `published` après ; adresse du créateur, identifiants des
trois campagnes et état d'avant dans la note de la ligne (aucune valeur de `.env.local`).
**Le fondateur vérifie** (poste et téléphone, FR puis EN) :
1. « Campagnes » ouvre le fil : nombre avant la liste, cartes sans montant ni tranche, nature de la
   rémunération et « À négocier avec votre commercial » ;
2. la campagne du secteur refusé et celle de la marque suspendue sont absentes, sans trace ;
3. la fiche d'une campagne visible : brief, livrables, marque et fonction de l'interlocuteur, aucune
   coordonnée, aucun bouton pour contacter la marque ni candidater ;
4. l'adresse de la fiche de la marque suspendue affiche « Cette campagne n'est plus ouverte » ;
5. tris et « Voir la suite » se comportent comme annoncé.
**Consigner :** la réponse du fondateur mot pour mot dans la note (160 caractères au plus), le détail
dans l'annexe § Revue ; tout constat devient une ligne `fix` ; remise en état de `staging` vérifiée.
