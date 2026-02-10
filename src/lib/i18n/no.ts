const no: Record<string, string> = {
  // Navigation
  'nav.scan': 'Skann',
  'nav.palette': 'Palett',
  'nav.collection': 'Samling',
  'nav.community': 'Oppdage',
  'nav.profile': 'Profil',

  // ScanTab
  'scan.title': 'NCS Lens',
  'scan.analyzing': 'Analyserer materialar',
  'scan.analyzing_desc': 'Identifiserer fargar og overflater...',
  'scan.sign_in_to_scan': 'Logg inn for å skanne',
  'scan.sign_in_desc': 'Opprett ein konto eller logg inn for å skanne materialar og fargar.',
  'scan.sign_in_button': 'Logg inn / Registrer',
  'scan.new_scan': 'Nytt skann',
  'scan.salient': 'Framtredande',
  'scan.help_text': 'Ta eit bilde for å identifisere NCS/RAL-kodar og materialoverflater på sekundet.',
  'scan.failed': 'Analysen feila. Prøv igjen.',

  // PaletteTab
  'palette.title': 'Palett',
  'palette.drop_to_analyze': 'Slepp for å analysere',
  'palette.extract': 'Trekk ut palett',
  'palette.upload_hint': 'Trykk for å laste opp eller slepp ei fil',
  'palette.extracted': 'Uttrekt palett',
  'palette.colors_count': '{count} fargar',
  'palette.chromatic_data': 'Kromatiske data',
  'palette.avg_lightness': 'Snitt lysheit',
  'palette.avg_chroma': 'Snitt kroma',
  'palette.bias_color': 'Bias (farge)',
  'palette.bias_light': 'Bias (lys)',
  'palette.diversity': 'Mangfald',
  'palette.high': 'Høg',
  'palette.low': 'Låg',
  'palette.details': 'Detaljar',
  'palette.name': 'Namn',
  'palette.collection': 'Samling',
  'palette.technical_data': 'Tekniske data',
  'palette.find_similar': 'Finn liknande fargar',

  // HistoryTab
  'history.title': 'Mi samling',
  'history.scans': 'Skanningar',
  'history.saved_colors': 'Lagra fargar',
  'history.no_scans': 'Ingen skanningar enno',
  'history.no_scans_hint': 'Ta eit bilde for å kome i gang!',
  'history.no_colors': 'Ingen lagra fargar enno',
  'history.no_colors_hint': 'Trykk på hjarteikona på ein farge for å lagre den!',

  // CommunityTab
  'community.title': 'Oppdage',
  'community.search_placeholder': 'Søk produkt, fargar, materialar...',
  'community.show_cards': 'Vis kort med bilete',
  'community.show_palette': 'Vis berre palett',
  'community.trending': 'Populært denne veka',
  'community.newest': 'Nyaste først',
  'community.most_liked': 'Mest likt',
  'community.no_results': 'Ingen resultat for "{query}"',
  'community.no_items': 'Ingen delte element enno',
  'community.colors_count': '{count} fargar',

  // ProfileTab
  'profile.title': 'Profil',
  'profile.app_title': 'NCS Lens',
  'profile.create_account': 'Opprett kontoen din',
  'profile.welcome_back': 'Velkomen tilbake',
  'profile.email_placeholder': 'E-postadresse',
  'profile.password_placeholder': 'Passord',
  'profile.confirm_password': 'Stadfest passord',
  'profile.create_account_btn': 'Opprett konto',
  'profile.sign_in_btn': 'Logg inn',
  'profile.has_account': 'Har du ein konto? Logg inn',
  'profile.no_account': 'Har du ikkje ein konto? Registrer deg',
  'profile.terms_agree': 'Ved å halde fram godtek du vilkåra våre',
  'profile.set_name': 'Skriv inn namn',
  'profile.account_settings': 'Kontoinnstillingar',
  'profile.display_name': 'Visingsnamn',
  'profile.enter_name': 'Skriv inn namnet ditt',
  'profile.email': 'E-post',
  'profile.save_changes': 'Lagre endringar',
  'profile.saved': 'Lagra!',
  'profile.vilkaar': 'Vilkår',
  'profile.sign_out': 'Logg ut',
  'profile.account_created': 'Konto oppretta {date}',
  'profile.passwords_no_match': 'Passorda er ikkje like',
  'profile.password_min': 'Passordet må vere minst 6 teikn',
  'profile.unexpected_error': 'Ein uventa feil oppstod',
  'profile.avatar_update_failed': 'Klarte ikkje oppdatere profilbilde',
  'profile.avatar_upload_failed': 'Klarte ikkje laste opp profilbilde',
  'profile.profile_update_failed': 'Klarte ikkje oppdatere profil',

  // ResultView
  'result.edit_name': 'Rediger produktnamn',
  'result.public_hint': 'Offentleg - trykk for å gjere privat',
  'result.private_hint': 'Privat - trykk for å publisere',
  'result.reanalyze': 'Analyser på nytt',
  'result.materials': 'Materialar',
  'result.regeneration_failed': 'Ny analyse feila.',
  'result.by_author': 'av {author}',

  // ColorDetailView
  'color.back': 'Tilbake',
  'color.blackness': 'Svartheit',
  'color.chroma': 'Kroma',
  'color.hue': 'Kulør',
  'color.standard': '{system}-standard',
  'color.details': 'Detaljar',
  'color.context': 'Kontekst',
  'color.compare': 'Samanlikne',
  'color.fine_tune': 'Finjuster',
  'color.name': 'Namn',
  'color.collection': 'Samling',
  'color.technical_data': 'Tekniske data',
  'color.lrv': 'LRV (D65)',
  'color.cmyk': 'CMYK lakk',
  'color.rgb': 'RGB-verdi',
  'color.material_id': 'Materialidentifikasjon',
  'color.standard_refs': 'Standardreferansar',
  'color.recent_scans': 'Nylige skanningar',
  'color.no_scans_compare': 'Ingen andre skanningar å samanlikne med.',
  'color.vs': 'VS',
  'color.find_similar': 'Finn liknande fargar ({count})',
  'color.similar_colors': 'Liknande fargar',
  'color.no_similar': 'Ingen liknande fargar funne',
  'color.no_similar_hint': 'Prøv å skanne fleire element!',
  'color.your_scans': 'Dine skanningar',
  'color.community_label': 'Fellesskap',
  'color.from_product': 'Frå: {product}',
  'color.match': 'Treff',
  'color.reset': 'Tilbakestill til original',
  'color.confirm': 'Stadfest endring',
  'color.no_context': 'Ingen materialdata tilgjengeleg',
  'color.no_context_hint': 'Skann eit produkt for å identifisere materialar',
  'color.delta_e': 'ΔE',
  'color.saved_colors_section': 'Lagra fargar',

  // Palette extras
  'palette.show_points': 'Vis uttrekkspunkt',
  'palette.pick_color': 'Plukk farge frå bilete',
  'palette.tap_to_pick': 'Trykk på bilete for å plukke ein farge',

  // User profile
  'profile.public_scans': 'Offentlege skanningar',
  'profile.member_since': 'Medlem sidan {date}',
  'profile.no_public_scans': 'Ingen offentlege skanningar enno',
  'profile.anonymous': 'Anonym',

  // Curated comparison names
  'color.pure_white': 'Reint kvit',
  'color.standard_white': 'Standard kvit',
  'color.middle_grey': 'Mellomgrå',
  'color.black': 'Svart',

  // Share
  'share.copied': 'Kopiert til utklippstavla',

  // Palette modal
  'palette.pantone_connect': 'Pantone Connect',

  // Error page
  'error.go_home': 'Gå heim',
  'error.something_wrong': 'Noko gjekk gale',

  // Toast
  'toast.error': 'Feil',
};

export default no;
