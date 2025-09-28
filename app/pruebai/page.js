// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import ConfiguracionInstagramPage from "@/_Pages/prueba/instagram/instagram";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <ConfiguracionInstagramPage></ConfiguracionInstagramPage>
      </ClienteWrapper>
    </div>
  );
}
