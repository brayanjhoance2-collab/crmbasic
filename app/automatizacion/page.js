// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import AutomatizacionPage from "@/_Pages/automatizacion/automatizacion";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <AutomatizacionPage></AutomatizacionPage>
      </ClienteWrapper>
    </div>
  );
}
