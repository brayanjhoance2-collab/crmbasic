// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import ConfiguracionRedesPage from "@/_Pages/configuracionredes/configuracionredes";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <ConfiguracionRedesPage></ConfiguracionRedesPage>
      </ClienteWrapper>
    </div>
  );
}
