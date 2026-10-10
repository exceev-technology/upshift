export const ProcessMap = ({ lang = 'fr' }) => {
  const content = {
    fr: {
      labels: {
        sectors: 'Votre secteur',
        previousSectors: 'Secteurs précédents',
        nextSectors: 'Secteurs suivants',
        stepPosition: (number, total) => 'Étape ' + number + ' sur ' + total,
        previousStep: 'Étape précédente',
        nextStep: 'Étape suivante',
        sharedRecord: 'Une fiche commune à chaque étape',
        company: 'Toute l’entreprise',
        companyIntro:
          'Les fonctions qui accompagnent chaque étape, sur les mêmes fiches.',
        platform: 'Le socle, sous chaque module',
        platformIntro: 'Les briques communes à tous les modules.',
        note: 'Ces étapes sont des exemples : votre chaîne suit vos propres étapes, autant qu’il en faut, et chaque espace de travail est configuré sur votre métier.',
      },
      sectors: [
        {
          name: 'Vue d’ensemble',
          steps: [
            [
              'Prospection et CRM',
              'Leads, comptes, contacts et opportunités, avec chaque échange sur la bonne fiche',
            ],
            [
              'Devis et commandes',
              'Devis multi-devises, circuits de validation, PDF envoyés au client, acomptes',
            ],
            [
              'Achats et stocks',
              'Demandes d’achat, commandes fournisseurs, réceptions, mouvements de stock',
            ],
            [
              'Projets et installations',
              'Visites techniques, prérequis du site, planning, équipes, réception',
            ],
            [
              'SAV et maintenance',
              'Tickets, interventions, contrats de maintenance, garanties, parc installé',
            ],
            [
              'Dashboards et reporting',
              'Pipeline, chiffre d’affaires, activité et KPI, par équipe et par entité',
            ],
          ],
        },
        {
          name: 'Industrie',
          steps: [
            ['Prospection', 'Distributeurs, grands comptes, appels d’offres'],
            ['Devis technique', 'Configurations produit, nomenclatures, prix'],
            ['Commande', 'Bons de commande, validation, acomptes'],
            [
              'Fabrication',
              'Ordres de fabrication, approvisionnement, qualité',
            ],
            ['Livraison', 'Expéditions, bons de livraison, facturation'],
            ['SAV et garantie', 'Garanties, maintenance, pièces détachées'],
          ],
        },
        {
          name: 'Services et conseil',
          steps: [
            ['Prospection', 'Leads, recommandations, rendez-vous'],
            ['Proposition', 'Offres, cadrage, estimation des charges'],
            ['Projet', 'Cadrage, jalons, planning et budget'],
            ['Mission', 'Staffing, temps passés, livrables'],
            ['Facturation', 'Factures à l’avancement, relances, encaissements'],
            ['Renouvellement', 'Satisfaction, extensions, nouvelles missions'],
          ],
        },
        {
          name: 'Distribution',
          steps: [
            ['Référencement', 'Revendeurs, points de vente, grands comptes'],
            ['Tarification', 'Grilles tarifaires, remises, promotions'],
            ['Commande', 'Commandes multi-devises, stocks, validation'],
            ['Préparation', 'Picking, colisage, réservations de stock'],
            ['Livraison', 'Tournées, preuves de livraison, factures'],
            ['Retours et SAV', 'Retours, avoirs, réclamations'],
          ],
        },
        {
          name: 'BTP et installation',
          steps: [
            ['Appel d’offres', 'Veille, dossiers de consultation, DCE'],
            ['Chiffrage', 'Métrés, devis par lots, sous-traitance'],
            ['Marché', 'Signature, avenants, acomptes'],
            ['Chantier', 'Planning, équipes, sous-traitants, situations'],
            ['Réception', 'PV, levée de réserves, DOE'],
            ['Maintenance', 'Contrats d’entretien, interventions, garanties'],
          ],
        },
        {
          name: 'Santé',
          steps: [
            ['Prise de RDV', 'Agenda multi-praticiens, rappels'],
            ['Accueil', 'Dossier patient, mutuelles, consentements'],
            ['Consultation', 'Comptes rendus, prescriptions, examens'],
            ['Soins et actes', 'Planning des soins, matériel, consommables'],
            ['Facturation', 'Tiers payant, feuilles de soins, encaissements'],
            ['Suivi', 'Contrôles, relances, satisfaction patient'],
          ],
        },
        {
          name: 'Équipement médical',
          steps: [
            [
              'Prospection',
              'Hôpitaux, cliniques, cabinets, pharmacies, appels d’offres publics',
            ],
            [
              'Devis et appels d’offres',
              'Configurations, prix fabricant en devises, marges, dossiers de soumission',
            ],
            [
              'Conformité réglementaire',
              'Homologations, certificats CE et ISO, dossiers techniques, échéances de renouvellement, matériovigilance et rappels',
            ],
            [
              'Achats et import',
              'Commandes fournisseurs, import, dédouanement, réceptions',
            ],
            [
              'Stock et livraison',
              'Lots, numéros de série, dates de péremption, livraisons',
            ],
            [
              'Installation et formation',
              'Visite technique, mise en service, PV de réception, formation des utilisateurs',
            ],
            [
              'SAV et maintenance',
              'Contrats de maintenance, interventions, pièces détachées, garanties',
            ],
          ],
        },
        {
          name: 'Immobilier',
          steps: [
            ['Lead', 'Acquéreurs, locataires, apporteurs'],
            ['Visite', 'Planification, comptes rendus, relances'],
            ['Réservation', 'Offres, simulations, contrats de réservation'],
            ['Compromis', 'Pièces, financement, notaire'],
            ['Livraison', 'Remise des clés, état des lieux, réserves'],
            ['Après-vente', 'Réclamations, interventions, garanties'],
          ],
        },
        {
          name: 'Agroalimentaire',
          steps: [
            ['Référencement', 'GMS, grossistes, export, fiches produit'],
            ['Commande', 'Commandes par canal, conditions commerciales'],
            ['Approvisionnement', 'Matières premières, fournisseurs, lots'],
            ['Production', 'Recettes, conditionnement, traçabilité'],
            ['Expédition', 'Chaîne du froid, DLC, livraisons'],
            ['Qualité', 'Non-conformités, retours, audits'],
          ],
        },
        {
          name: 'Transport et logistique',
          steps: [
            ['Cotation', 'Tarifs par trajet, volume et délai'],
            ['Ordre de transport', 'Réservations, affrètement, documents'],
            ['Planification', 'Tournées, véhicules, chauffeurs'],
            ['Enlèvement', 'Chargement, contrôle, suivi en temps réel'],
            ['Livraison', 'Preuves de livraison, litiges, avaries'],
            ['Facturation', 'Frais annexes, factures, coût par km'],
          ],
        },
        {
          name: 'Énergie et environnement',
          steps: [
            ['Étude', 'Visite technique, dimensionnement, rendement'],
            ['Devis', 'Offre chiffrée, options, simulations'],
            ['Financement', 'Subventions, leasing, dossiers bancaires'],
            ['Installation', 'Planning chantier, équipes, matériel'],
            ['Mise en service', 'Raccordement, tests, conformité'],
            ['Maintenance', 'Préventif, astreintes, production suivie'],
          ],
        },
        {
          name: 'Automobile et équipement',
          steps: [
            ['Lead', 'Particuliers, flottes, showroom, web'],
            ['Essai', 'Réservation du véhicule, compte rendu'],
            ['Bon de commande', 'Configuration, reprise, financement'],
            ['Préparation', 'Immatriculation, accessoires, contrôle'],
            ['Livraison', 'Remise du véhicule, documents'],
            ['Atelier', 'Entretien, garanties, ordres de réparation'],
          ],
        },
        {
          name: 'Éducation et formation',
          steps: [
            ['Candidature', 'Demandes, entretiens, dossiers'],
            ['Admission', 'Tests, décisions, listes d’attente'],
            ['Inscription', 'Conventions, paiements, échéanciers'],
            ['Formation', 'Planning, formateurs, salles, présences'],
            ['Évaluation', 'Examens, notes, suivi pédagogique'],
            ['Certification', 'Attestations, diplômes, alumni'],
          ],
        },
        {
          name: 'Hôtellerie et événementiel',
          steps: [
            ['Demande', 'Agences, entreprises, organisateurs'],
            ['Proposition', 'Offres groupes, menus, espaces'],
            ['Réservation', 'Contrats, acomptes, rooming lists'],
            ['Organisation', 'Prestataires, logistique, feuille de route'],
            ['Jour J', 'Accueil, coordination, incidents'],
            ['Fidélisation', 'Avis, facturation finale, relances'],
          ],
        },
        {
          name: 'Tech et télécoms',
          steps: [
            ['Lead', 'Inbound, partenaires, revendeurs'],
            ['Démo', 'Qualification, besoins, démonstration'],
            ['Contrat', 'Abonnements, licences, signature'],
            ['Déploiement', 'Activation, intégration, recette'],
            ['Support', 'Tickets, SLA, escalades'],
            ['Renouvellement', 'Usage, upsell, MRR et churn'],
          ],
        },
        {
          name: 'Associations et secteur public',
          steps: [
            ['Demande', 'Usagers, bénéficiaires, partenaires'],
            ['Instruction', 'Pièces justificatives, éligibilité'],
            ['Validation', 'Circuits de signature, commissions'],
            ['Mise en œuvre', 'Actions terrain, budgets, marchés'],
            ['Suivi', 'Relances, réclamations, échanges'],
            ['Évaluation', 'Indicateurs d’impact et reporting'],
          ],
        },
      ],
      areas: [
        [
          'RH',
          'Recrutement, contrats de travail, absences et congés, temps et notes de frais, entretiens annuels, compétences et habilitations, documents RH',
        ],
        [
          'Formation',
          'Catalogue, sessions, inscriptions, présences et attestations, pour vos équipes comme pour vos clients',
        ],
        [
          'Finance',
          'Factures et échéanciers, encaissements, relances, avoirs, factures fournisseurs, plusieurs devises',
        ],
        [
          'Contrats et financement',
          'Contrats clients et de maintenance, avenants, dossiers de financement, garanties',
        ],
        [
          'Qualité et réglementation',
          'Homologations, conformité, audits, non-conformités, vigilance',
        ],
        [
          'Parc installé',
          'Chaque équipement livré, avec son numéro de série, son site et ses interventions',
        ],
        [
          'Référentiel',
          'Sociétés, contacts, produits, fabricants, tarifs et entités, partagés par tous les modules',
        ],
      ],
      capabilities: [
        ['Modèle de données', 'Objets, champs et relations personnalisés'],
        ['Vues', 'Tableaux et kanbans, avec filtres et tris par équipe'],
        [
          'Workflows sans code',
          'Déclencheurs, validations et rappels automatiques',
        ],
        ['Dashboards', 'Graphiques et KPI que vous construisez vous-même'],
        ['E-mail et agenda', 'Chaque échange arrive sur la bonne fiche'],
        ['WhatsApp et appels', 'Intégrés, bientôt disponibles'],
        [
          'Historique des fiches',
          'Chronologie, notes, tâches et fichiers sur chaque fiche',
        ],
        ['Rôles et permissions', 'Définis par équipe et par utilisateur'],
        [
          'Documents métier',
          'Devis, factures et documents métier générés en PDF',
        ],
        ['Import et export', 'Depuis et vers Excel ou CSV'],
        ['API et webhooks', 'Connectez vos autres outils'],
        [
          'IA native',
          'Chat IA, agents dans vos workflows, et MCP pour ChatGPT ou Claude',
        ],
      ],
    },
    en: {
      labels: {
        sectors: 'Your industry',
        previousSectors: 'Previous industries',
        nextSectors: 'Next industries',
        stepPosition: (number, total) => 'Step ' + number + ' of ' + total,
        previousStep: 'Previous step',
        nextStep: 'Next step',
        sharedRecord: 'One shared record at every step',
        company: 'The whole company',
        companyIntro: 'The functions around every step, on the same records.',
        platform: 'The foundation, under every module',
        platformIntro: 'The building blocks every module shares.',
        note: 'These steps are examples: your chain follows your own steps, as many as you need, and every workspace is configured around your business.',
      },
      sectors: [
        {
          name: 'Overview',
          steps: [
            [
              'Prospecting and CRM',
              'Leads, accounts, contacts and opportunities, with every exchange on the right record',
            ],
            [
              'Quotes and orders',
              'Multi-currency quotes, approval flows, PDFs sent to the customer, deposits',
            ],
            [
              'Purchasing and stock',
              'Purchase requests, supplier orders, receipts, stock movements',
            ],
            [
              'Projects and installations',
              'Site surveys, site prerequisites, planning, teams, acceptance',
            ],
            [
              'After-sales and maintenance',
              'Tickets, interventions, maintenance contracts, warranties, installed base',
            ],
            [
              'Dashboards and reporting',
              'Pipeline, revenue, activity and KPIs, by team and by entity',
            ],
          ],
        },
        {
          name: 'Manufacturing',
          steps: [
            ['Prospecting', 'Distributors, key accounts, tenders'],
            [
              'Technical quote',
              'Product configurations, bills of materials, prices',
            ],
            ['Order', 'Purchase orders, approval, deposits'],
            ['Production', 'Production orders, supply, quality'],
            ['Delivery', 'Shipments, delivery notes, invoicing'],
            [
              'After-sales and warranty',
              'Warranties, maintenance, spare parts',
            ],
          ],
        },
        {
          name: 'Services and consulting',
          steps: [
            ['Prospecting', 'Leads, referrals, meetings'],
            ['Proposal', 'Offers, scoping, effort estimates'],
            ['Project', 'Scoping, milestones, schedule and budget'],
            ['Engagement', 'Staffing, time spent, deliverables'],
            ['Invoicing', 'Progress invoices, reminders, collections'],
            ['Renewal', 'Satisfaction, extensions, new engagements'],
          ],
        },
        {
          name: 'Distribution',
          steps: [
            ['Listing', 'Resellers, points of sale, key accounts'],
            ['Pricing', 'Price lists, discounts, promotions'],
            ['Order', 'Multi-currency orders, stock, approval'],
            ['Picking', 'Picking, packing, stock reservations'],
            ['Delivery', 'Delivery rounds, proof of delivery, invoices'],
            ['Returns and after-sales', 'Returns, credit notes, claims'],
          ],
        },
        {
          name: 'Construction and installation',
          steps: [
            ['Tender', 'Monitoring, tender files, specifications'],
            ['Costing', 'Quantity surveys, quotes by lot, subcontracting'],
            ['Contract', 'Signature, amendments, deposits'],
            ['Worksite', 'Schedule, teams, subcontractors, progress billing'],
            ['Handover', 'Acceptance reports, snag clearance, as-built files'],
            ['Maintenance', 'Service contracts, interventions, warranties'],
          ],
        },
        {
          name: 'Healthcare',
          steps: [
            ['Appointments', 'Multi-practitioner calendar, reminders'],
            ['Reception', 'Patient file, insurers, consents'],
            ['Consultation', 'Reports, prescriptions, tests'],
            ['Care and procedures', 'Care schedule, equipment, consumables'],
            ['Billing', 'Third-party payment, care sheets, collections'],
            ['Follow-up', 'Check-ups, reminders, patient satisfaction'],
          ],
        },
        {
          name: 'Medical equipment',
          steps: [
            [
              'Prospecting',
              'Hospitals, clinics, practices, pharmacies, public tenders',
            ],
            [
              'Quotes and tenders',
              'Configurations, manufacturer prices in foreign currency, margins, bid files',
            ],
            [
              'Regulatory compliance',
              'Device registrations, CE and ISO certificates, technical files, renewal dates, vigilance and recalls',
            ],
            [
              'Purchasing and import',
              'Supplier orders, import, customs clearance, receipts',
            ],
            [
              'Stock and delivery',
              'Batches, serial numbers, expiry dates, deliveries',
            ],
            [
              'Installation and training',
              'Site survey, commissioning, acceptance report, user training',
            ],
            [
              'After-sales and maintenance',
              'Maintenance contracts, interventions, spare parts, warranties',
            ],
          ],
        },
        {
          name: 'Real estate',
          steps: [
            ['Lead', 'Buyers, tenants, referrers'],
            ['Viewing', 'Scheduling, reports, follow-ups'],
            ['Reservation', 'Offers, simulations, reservation contracts'],
            ['Sale agreement', 'Documents, financing, notary'],
            ['Handover', 'Key handover, inventory, snags'],
            ['After-sales', 'Claims, interventions, warranties'],
          ],
        },
        {
          name: 'Food and beverage',
          steps: [
            ['Listing', 'Retail chains, wholesalers, export, product sheets'],
            ['Order', 'Orders by channel, trade terms'],
            ['Sourcing', 'Raw materials, suppliers, batches'],
            ['Production', 'Recipes, packaging, traceability'],
            ['Shipping', 'Cold chain, use-by dates, deliveries'],
            ['Quality', 'Non-conformities, returns, audits'],
          ],
        },
        {
          name: 'Transport and logistics',
          steps: [
            ['Quotation', 'Rates by route, volume and lead time'],
            ['Transport order', 'Bookings, chartering, documents'],
            ['Planning', 'Rounds, vehicles, drivers'],
            ['Pickup', 'Loading, checks, real-time tracking'],
            ['Delivery', 'Proof of delivery, disputes, damage'],
            ['Invoicing', 'Extra charges, invoices, cost per km'],
          ],
        },
        {
          name: 'Energy and environment',
          steps: [
            ['Survey', 'Site visit, sizing, yield'],
            ['Quote', 'Priced offer, options, simulations'],
            ['Financing', 'Grants, leasing, bank files'],
            ['Installation', 'Site schedule, teams, equipment'],
            ['Commissioning', 'Grid connection, tests, compliance'],
            ['Maintenance', 'Preventive, on-call, production monitoring'],
          ],
        },
        {
          name: 'Automotive and equipment',
          steps: [
            ['Lead', 'Individuals, fleets, showroom, web'],
            ['Test drive', 'Vehicle booking, report'],
            ['Purchase order', 'Configuration, trade-in, financing'],
            ['Preparation', 'Registration, accessories, inspection'],
            ['Delivery', 'Vehicle handover, documents'],
            ['Workshop', 'Servicing, warranties, repair orders'],
          ],
        },
        {
          name: 'Education and training',
          steps: [
            ['Application', 'Requests, interviews, files'],
            ['Admission', 'Tests, decisions, waiting lists'],
            ['Enrollment', 'Agreements, payments, payment schedules'],
            ['Training', 'Schedule, trainers, rooms, attendance'],
            ['Assessment', 'Exams, grades, academic follow-up'],
            ['Certification', 'Certificates, diplomas, alumni'],
          ],
        },
        {
          name: 'Hospitality and events',
          steps: [
            ['Request', 'Agencies, companies, organizers'],
            ['Proposal', 'Group offers, menus, venues'],
            ['Booking', 'Contracts, deposits, rooming lists'],
            ['Planning', 'Suppliers, logistics, run sheet'],
            ['Event day', 'Welcome, coordination, incidents'],
            ['Loyalty', 'Reviews, final invoicing, follow-ups'],
          ],
        },
        {
          name: 'Tech and telecoms',
          steps: [
            ['Lead', 'Inbound, partners, resellers'],
            ['Demo', 'Qualification, needs, demo'],
            ['Contract', 'Subscriptions, licenses, signature'],
            ['Deployment', 'Activation, integration, acceptance testing'],
            ['Support', 'Tickets, SLAs, escalations'],
            ['Renewal', 'Usage, upsell, MRR and churn'],
          ],
        },
        {
          name: 'Non-profit and public sector',
          steps: [
            ['Request', 'Users, beneficiaries, partners'],
            ['Review', 'Supporting documents, eligibility'],
            ['Approval', 'Signature flows, committees'],
            ['Delivery', 'Field actions, budgets, public contracts'],
            ['Follow-up', 'Reminders, claims, exchanges'],
            ['Evaluation', 'Impact indicators and reporting'],
          ],
        },
      ],
      areas: [
        [
          'HR',
          'Recruitment, employment contracts, leave and absences, time and expenses, annual reviews, skills and certifications, HR documents',
        ],
        [
          'Training',
          'Catalog, sessions, enrollments, attendance and certificates, for your teams and your customers',
        ],
        [
          'Finance',
          'Invoices and payment schedules, collections, reminders, credit notes, supplier invoices, multiple currencies',
        ],
        [
          'Contracts and financing',
          'Customer and maintenance contracts, amendments, financing files, guarantees',
        ],
        [
          'Quality and compliance',
          'Approvals, compliance, audits, non-conformities, vigilance',
        ],
        [
          'Installed base',
          'Every delivered unit, with its serial number, site and interventions',
        ],
        [
          'Master data',
          'Companies, contacts, products, manufacturers, prices and entities, shared by every module',
        ],
      ],
      capabilities: [
        ['Data model', 'Custom objects, fields and relations'],
        ['Views', 'Tables and kanbans, with filters and sorts per team'],
        ['No-code workflows', 'Triggers, approvals and automatic reminders'],
        ['Dashboards', 'Charts and KPIs you build yourself'],
        ['Email and calendar', 'Every exchange lands on the right record'],
        ['WhatsApp and calls', 'Built in, coming soon'],
        ['Record history', 'Timeline, notes, tasks and files on every record'],
        ['Roles and permissions', 'Set per team and per user'],
        [
          'Business documents',
          'Quotes, invoices and business documents generated as PDF',
        ],
        ['Import and export', 'From and to Excel or CSV'],
        ['API and webhooks', 'Connect your other tools'],
        [
          'Native AI',
          'AI chat, agents in your workflows, and MCP for ChatGPT or Claude',
        ],
      ],
    },
  }[lang];

  const [sectorIndex, setSectorIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [railEdges, setRailEdges] = useState({ start: true, end: false });
  const railRef = useRef(null);
  const stepRefs = useRef([]);

  const { labels, sectors, areas, capabilities } = content;
  const sector = sectors[sectorIndex];
  const lastStepIndex = sector.steps.length - 1;
  const [stepTitle, stepDetail] = sector.steps[stepIndex];
  const idPrefix = 'upshift-process-map-' + lang;

  const selectSector = (index, chip) => {
    setSectorIndex(index);
    setStepIndex(0);
    chip.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  };

  const updateRailEdges = () => {
    const rail = railRef.current;

    setRailEdges({
      start: rail.scrollLeft <= 1,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1,
    });
  };

  const scrollRail = (direction) => {
    const rail = railRef.current;

    rail.scrollBy({
      left: direction * rail.clientWidth * 0.6,
      behavior: 'smooth',
    });
  };

  const handleStepKeyDown = (event) => {
    const targetIndex = {
      ArrowDown: Math.min(stepIndex + 1, lastStepIndex),
      ArrowUp: Math.max(stepIndex - 1, 0),
      Home: 0,
      End: lastStepIndex,
    }[event.key];

    if (targetIndex === undefined) {
      return;
    }

    event.preventDefault();
    setStepIndex(targetIndex);
    stepRefs.current[targetIndex]?.focus();
  };

  const renderChevron = (direction) => (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={
          direction === 'previous'
            ? 'M10 3.5 5.5 8l4.5 4.5'
            : 'M6 3.5 10.5 8 6 12.5'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const renderIconButton = (direction, label, isDisabled, onClick) => (
    <button
      type="button"
      className="upshift-process-map__icon-button"
      aria-label={label}
      disabled={isDisabled}
      onClick={onClick}
    >
      {renderChevron(direction)}
    </button>
  );

  return (
    <div className="upshift-process-map not-prose" lang={lang}>
      <div className="upshift-process-map__rail-header">
        <p className="upshift-process-map__caption">{labels.sectors}</p>
        <div className="upshift-process-map__controls">
          {renderIconButton(
            'previous',
            labels.previousSectors,
            railEdges.start,
            () => scrollRail(-1),
          )}
          {renderIconButton('next', labels.nextSectors, railEdges.end, () =>
            scrollRail(1),
          )}
        </div>
      </div>
      <div
        ref={railRef}
        className="upshift-process-map__rail"
        role="group"
        aria-label={labels.sectors}
        data-start={railEdges.start}
        data-end={railEdges.end}
        onScroll={updateRailEdges}
      >
        {sectors.map((item, index) => (
          <button
            key={item.name}
            type="button"
            className="upshift-process-map__chip"
            aria-pressed={index === sectorIndex}
            onClick={(event) => selectSector(index, event.currentTarget)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="upshift-process-map__explorer">
        <div>
          <ol
            key={sectorIndex}
            className="upshift-process-map__steps"
            role="tablist"
            aria-orientation="vertical"
            aria-label={sector.name}
            onKeyDown={handleStepKeyDown}
          >
            {sector.steps.map(([title], index) => (
              <li
                key={title}
                className="upshift-process-map__step"
                role="presentation"
              >
                <button
                  ref={(node) => {
                    stepRefs.current[index] = node;
                  }}
                  id={idPrefix + '-step-' + index}
                  type="button"
                  role="tab"
                  className="upshift-process-map__step-button"
                  aria-selected={index === stepIndex}
                  aria-controls={idPrefix + '-panel'}
                  tabIndex={index === stepIndex ? 0 : -1}
                  onClick={() => setStepIndex(index)}
                >
                  <span className="upshift-process-map__step-number">
                    {index + 1}
                  </span>
                  <span>{title}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="upshift-process-map__shared">{labels.sharedRecord}</p>
        </div>
        <div
          id={idPrefix + '-panel'}
          className="upshift-process-map__panel"
          role="tabpanel"
          aria-labelledby={idPrefix + '-step-' + stepIndex}
        >
          <div
            key={sectorIndex + '-' + stepIndex}
            className="upshift-process-map__panel-body"
          >
            <p className="upshift-process-map__caption">
              {labels.stepPosition(stepIndex + 1, sector.steps.length)}
            </p>
            <p className="upshift-process-map__panel-title">{stepTitle}</p>
            <p className="upshift-process-map__panel-text">{stepDetail}</p>
          </div>
          <div className="upshift-process-map__controls">
            {renderIconButton(
              'previous',
              labels.previousStep,
              stepIndex === 0,
              () => setStepIndex(stepIndex - 1),
            )}
            {renderIconButton(
              'next',
              labels.nextStep,
              stepIndex === lastStepIndex,
              () => setStepIndex(stepIndex + 1),
            )}
          </div>
        </div>
      </div>
      <p className="upshift-process-map__note">{labels.note}</p>
      <section className="upshift-process-map__section">
        <p className="upshift-process-map__heading">{labels.company}</p>
        <p className="upshift-process-map__intro">{labels.companyIntro}</p>
        <dl className="upshift-process-map__areas">
          {areas.map(([title, detail]) => (
            <div key={title} className="upshift-process-map__area">
              <dt>{title}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="upshift-process-map__section">
        <p className="upshift-process-map__heading">{labels.platform}</p>
        <p className="upshift-process-map__intro">{labels.platformIntro}</p>
        <ul className="upshift-process-map__capabilities">
          {capabilities.map(([title, detail]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
