// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import ReportesPage from "@/_Pages/reportes/reportes";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <ReportesPage></ReportesPage>
      </ClienteWrapper>
    </div>
  );
}
