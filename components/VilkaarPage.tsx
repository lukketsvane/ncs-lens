import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface VilkaarPageProps {
  onBack: () => void;
}

export function VilkaarPage({ onBack }: VilkaarPageProps) {
  return (
    <div className="min-h-full bg-white safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="font-semibold text-gray-900">Vilkår</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-2xl mx-auto pb-24">
        <article className="prose prose-sm prose-gray">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vilkår for NCS Fargeverktøy</h1>
          <p className="text-sm text-gray-500 mb-8"><em>Sist oppdatert: 13. januar 2026</em></p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Partar</h2>
          
          <p className="mb-4">
            <strong>Seljar:</strong><br />
            Finne Koder<br />
            Org.nr: 919 598 107<br />
            E-post: iverfinne@gmail.com<br />
            Adresse: Toftes gate 58, 0552 Oslo
          </p>
          
          <p className="mb-4">
            <strong>Kjøpar:</strong><br />
            Den som registrerer seg for abonnement i appen.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Om tenesta</h2>
          <p className="text-gray-700 mb-4">
            NCS Fargeverktøy er ein app for fargegjenkjenning og oppslag av profesjonelle fargekoder (NCS, RAL m.m.). Brukarar kan skanne fargar med kameraet og få fram tilhøyrande fargekoder.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Prisar og betaling</h2>
          <p className="text-gray-700 mb-4">
            Alle prisar er oppgitt i norske kroner (NOK) inkludert meirverdiavgift.
          </p>
          <p className="text-gray-700 mb-4">
            Betaling skjer via Vipps. Ved kjøp av abonnement vil beløpet bli trekt automatisk kvar månad/år inntil abonnementet blir sagt opp.
          </p>
          <p className="text-gray-700 mb-4">Gjeldande prisar:</p>
          <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
            <li>Månadsabonnement: 49 kr/månad</li>
            <li>Årsabonnement: 399 kr/år</li>
          </ul>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Levering</h2>
          <p className="text-gray-700 mb-4">
            Tilgang til tenesta blir gitt umiddelbart etter godkjent betaling. Du får tilgang til alle premium-funksjonar i appen så lenge abonnementet er aktivt.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Abonnement og oppseiing</h2>
          <p className="text-gray-700 mb-4">
            Abonnementet blir automatisk fornya ved slutten av kvar periode. Du kan når som helst seie opp abonnementet:
          </p>
          <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-1">
            <li>Opne appen og gå til «Profil»</li>
            <li>Vel «Abonnement»</li>
            <li>Trykk «Sei opp abonnement»</li>
          </ol>
          <p className="text-gray-700 mb-4">
            Oppseiinga gjeld frå neste betalingsperiode. Du beheld tilgang til premium-funksjonar ut inneverande periode.
          </p>
          <p className="text-gray-700 mb-4">
            Du kan også kontakte oss på iverfinne@gmail.com for å seie opp.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Angrerett</h2>
          <p className="text-gray-700 mb-4">
            Ved kjøp av digitale tenester gjeld angreretten fram til tenesta blir tatt i bruk. Når du aktiverer abonnementet og får tilgang til premium-funksjonane, samtykkjer du til at leveringa startar, og du gir samstundes avkall på angreretten i samsvar med angrerettlova § 22 bokstav n.
          </p>
          <p className="text-gray-700 mb-4">
            Dersom du ikkje har tatt tenesta i bruk, har du 14 dagars angrerett frå kjøpsdato. For å nytte angreretten, kontakt oss på iverfinne@gmail.com.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Retur og refusjon</h2>
          <p className="text-gray-700 mb-4">
            Sidan dette er ei digital teneste, gjeld ikkje vanleg returrett. Ved tekniske problem som gjer tenesta ubrukelig, kan du ha krav på refusjon. Kontakt oss for vurdering.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Reklamasjon</h2>
          <p className="text-gray-700 mb-4">
            Dersom tenesta ikkje fungerer som beskrive, har du rett til å reklamere. Meld frå til oss snarast mogleg etter at du oppdaga feilen.
          </p>
          <p className="text-gray-700 mb-4">Ved gyldig reklamasjon vil vi:</p>
          <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-1">
            <li>Rette feilen så raskt som mogleg</li>
            <li>Forlenge abonnementsperioden tilsvarande nedetida</li>
            <li>Ved vesentleg feil: tilby refusjon</li>
          </ol>
          <p className="text-gray-700 mb-4">
            Reklamasjonsfrist er 2 år frå kjøpstidspunktet.
          </p>
          <p className="text-gray-700 mb-4">
            Kontakt: iverfinne@gmail.com
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Klagehandsaming og konfliktløysing</h2>
          <p className="text-gray-700 mb-4">
            Ved usemje, ta først kontakt med oss på iverfinne@gmail.com. Vi svarar innan 5 virkedagar.
          </p>
          <p className="text-gray-700 mb-4">Dersom vi ikkje kjem til semje, kan du klage til:</p>
          <p className="text-gray-700 mb-4">
            <strong>Forbrukartilsynet</strong><br />
            Postboks 2862 Kjørbekk<br />
            3702 Skien<br />
            forbrukertilsynet.no
          </p>
          <p className="text-gray-700 mb-4">
            <strong>Forbrukarrådet</strong><br />
            Klageordninga for digitale tenester<br />
            forbrukerradet.no
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Personvern</h2>
          <p className="text-gray-700 mb-4">
            Sjå vår <button 
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/personvern');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-blue-600 hover:underline"
            >personvernerklæring</button> for informasjon om korleis vi handsamar personopplysningar.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-4">Endringar i vilkåra</h2>
          <p className="text-gray-700 mb-4">
            Vi kan endre desse vilkåra med 30 dagars varsel. Ved vesentlege endringar vil du bli varsla via e-post eller i appen. Fortset du å bruke tenesta etter endringa, godtek du dei nye vilkåra.
          </p>
        </article>
      </div>
    </div>
  );
}
