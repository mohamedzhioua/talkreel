// Mermaid configuration for the default theme.
// The composer imports this object and passes it to mermaid.initialize() in
// the generated page. deterministicIds keeps SVG ids stable between renders.
export default {
  startOnLoad: false,
  securityLevel: "strict",
  deterministicIds: true,
  deterministicIDSeed: "talkreel",
  theme: "base",
  fontFamily: "Inter, Segoe UI, Arial, sans-serif",
  flowchart: { htmlLabels: false, curve: "basis", padding: 24, nodeSpacing: 70, rankSpacing: 90, useMaxWidth: false },
  themeVariables: {
    darkMode: true,
    background: "transparent",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    fontSize: "30px",
    primaryColor: "#151820",
    primaryBorderColor: "#f5a524",
    primaryTextColor: "#f3f0e8",
    secondaryColor: "#1c2029",
    secondaryBorderColor: "#a3aab9",
    secondaryTextColor: "#f3f0e8",
    tertiaryColor: "#1c2029",
    tertiaryBorderColor: "#2b303c",
    tertiaryTextColor: "#f3f0e8",
    lineColor: "#a3aab9",
    textColor: "#f3f0e8",
    edgeLabelBackground: "#0b0c10",
    clusterBkg: "#11141a",
    clusterBorder: "#2b303c",
    titleColor: "#f3f0e8",
  },
};
