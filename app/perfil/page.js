// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import PerfilPage from "@/_Pages/perfil/perfil";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <PerfilPage></PerfilPage>
      </ClienteWrapper>
    </div>
  );
}
