Je recherche à coder un simulateur de placement immobilier sur une page web unique
**Stack Technique :** HTML5, Tailwind CSS pour le design, et Chart.js pour la visualisation des données.

---

### 1. SECTION : PARAMÈTRES D'ENTRÉE (INPUTS)

L'interface doit permettre de saisir les variables suivantes :

- **Profil Utilisateur :**
    
    - Salaire Net après impôts (€/mois).
        
    - Capital total possédé (Épargne totale) (€).
        
    - Apport personnel maximum dédié au projet immo (€).
        
    - Loyer actuel (si reste locataire) (€).
        
    - Taux d'endettement maximum souhaité (Défaut 35%).
        
- **Hypothèses de Marché :**
    
    - Inflation annuelle estimée (%).
        
    - Croissance annuelle de la valeur du bien (%).
        
    - Rendement annuel de l'épargne placée (Coût d'opportunité) (%).
        
    - Durée de la simulation (Défaut 20 ans).
        

---

### 2. SECTION : SCÉNARIOS D'ACHAT (LOGIQUE MÉTIER)

Le programme doit calculer automatiquement le **Budget Max d'achat** pour chaque scénario en déduisant les frais et charges du taux d'endettement.

**Éléments communs à déduire de la capacité de remboursement mensuelle :**

- Taxe foncière (estimer à 1 mois de mensualité/an par défaut).
    
- Charges de copropriété (€/mois).
    
- Provision travaux (0.5% à 1% de la valeur du bien / an).
    
- Assurance Habitation (€/mois).
    

**Scénario A : Achat Ancien (Prêt Classique)**

- Frais de notaire : 7.5%.
- Frais annexes par défaut : Agence (5%), Garantie (1%), Dossier (500€), Courtier (2000€).
- Financement : Un seul prêt bancaire (Taux, Durée, Assurance emprunteur).
-  sélecteur de DPE.  C -> applique rien sur le prêt bancaire.
    

**Scénario B : Achat Neuf (Prêts Multiples)**

- Frais de notaire : 3%.
- Frais annexes réduits (pas d'agence souvent).
- sélecteur de DPE.  A -> applique une légère réduction de taux automatique sur le prêt bancaire.
    
- Financement hybride :
    
    1. Prêt Bancaire Classique.
        
    2. Prêt Action Logement (ex: 30 000€ à taux réduit + différé 10 ans).
        
    3. PTZ (Prêt à Taux Zéro) : selon zone/revenus (ex: 75 000€).
        
    - _Note :_ Gérer le différé
        

simulateur doit effectuer un **lissage** pour que la mensualité totale soit stable
Quand on a 3 prêts (Banque + PTZ + Action Logement), on ne veut pas cumuler les mensualités, on veut une mensualité unique constante sur 20 ans

**Calcul itératif du Budget Max (Recherche de Valeur Cible) :** Le prix du bien (V) et les frais (notaire, agence, garantie) sont interdépendants.
- **Instruction :** Ne pas utiliser une simple soustraction. Implémenter une boucle de calcul itératif (type `while`) pour trouver le prix du bien maximum tel que :
V+FraisNotaire(V)+FraisAgence(V)+Garantie(V)+Dossier+Travaux=Apport+Emprunt Max
    L'itération doit s'arrêter quand la différence est inférieure à 1 €.
    
Algorithme de Lissage de Prêts (Multi-lignes) :** Dans le scénario "Neuf" ou avec aides (PTZ, Action Logement), l'utilisateur peut avoir jusqu'à 3 lignes de prêt avec des durées et des taux différents.

- **Instruction :** Créer une fonction de lissage pour maintenir une **mensualité globale constante** (Assurance incluse).
- Le prêt principal doit être calculé "en tunnel" : sa mensualité s'ajuste (diminue) mécaniquement pendant les périodes où le PTZ ou le prêt Action Logement sont remboursés, afin que le total ne dépasse jamais le plafond d'endettement.
    

---

### 3. SECTION : SCÉNARIO LOCATAIRE (COMPARAISON)

C'est le scénario de référence pour la courbe de patrimoine :

- Le locataire place son **Apport personnel** initial au "Taux de rendement épargne".
    
- Chaque mois, le locataire place la **différence** entre (Mensualité Achat + Charges Achat) et son (Loyer actuel).
    
- Le loyer augmente chaque année selon l'indice de l'inflation.
    

---

### 4. CALCULS ET SORTIES (OUTPUTS)

Pour chaque scénario d'achat, afficher :

1. **Le coût total du crédit :** (Somme des mensualités + assurance + frais) - Capital emprunté.
    
2. **Le coût réel après inflation :** Valeur actualisée de toutes les sorties d'argent.
    
3. **Le reste à vivre réel :** Salaire - (Mensualité + Charges + Taxes).
    

---

### 5. VISUALISATION (LA COURBE)

Générer un graphique **Chart.js** comparant l'évolution du patrimoine net sur X années :

- **Courbe Achat :** (Valeur du bien avec croissance) - (Capital restant dû à la banque) - (Frais de revente théoriques). N'oublie pas d'ajouter au patrimoine le reliquat d'épargne non utilisé dans l'apport, placé au taux de rendement épargne.
    
- **Courbe Location :** (Capital initial placé + versements mensuels) avec intérêts composés.
    

---

### 6. UX / UI RECOMMANDATIONS

- Utiliser des **sliders** pour les taux et l'inflation.
    
- Mettre un **Switch Case (Toggle)** pour passer rapidement d'une configuration "Neuf" à "Ancien" (maj des frais de notaire auto).
    
- Design "Clean & Dark mode friendly" avec Tailwind.