// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import ConfiguracionesPage from "@/_Pages/configuraciones/configuraciones";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <ConfiguracionesPage></ConfiguracionesPage>
      </ClienteWrapper>
    </div>
  );
}
