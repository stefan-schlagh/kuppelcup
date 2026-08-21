interface ImpressumProps {
  onBack: () => void;
}

// Legal notice (Impressum, § 5 ECG / § 5 TMG). Reachable only from the Admin
// tab (see KuppelCup.tsx) -- not part of the public spectator views.
export default function Impressum({ onBack }: ImpressumProps) {
  return (
    <div className="impressum">
      <h3 className="panel-title">Impressum</h3>

      <h4>Medieninhaber &amp; Herausgeber</h4>
      <p>
        Stefan Schlaghuber
        <br />
        2002 Ringendorf
      </p>

      <h4>Kontakt</h4>
      <p>
        E-Mail: stefan.schlaghuber@proton.me
      </p>

      <button className="pin-btn login-secondary" onClick={onBack} style={{ marginTop: 16 }}>
        Zurück
      </button>
    </div>
  );
}
