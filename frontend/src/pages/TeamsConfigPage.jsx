import { useEffect } from "react";

export default function TeamsConfigPage() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://res.cdn.office.net/teams-js/2.22.0/js/MicrosoftTeams.min.js";
    script.onload = () => {
      window.microsoftTeams.app.initialize().then(() => {
        window.microsoftTeams.pages.config.registerOnSaveHandler((saveEvent) => {
          window.microsoftTeams.pages.config.setConfig({
            contentUrl: "https://gd-zyra-production-8f0a.up.railway.app",
            websiteUrl: "https://gd-zyra-production-8f0a.up.railway.app",
            suggestedDisplayName: "Zyra Dashboard",
          });
          saveEvent.notifySuccess();
        });
        window.microsoftTeams.pages.config.setValidState(true);
      });
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f3f2f1", fontFamily:"sans-serif" }}>
      <div style={{ background:"white", borderRadius:8, padding:32, textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,.1)" }}>
        <h2 style={{ marginTop:0, color:"#1a1a2e" }}>Zyra Call Dashboard</h2>
        <p>Click <strong>Save</strong> to add this tab to your channel.</p>
      </div>
    </div>
  );
}
