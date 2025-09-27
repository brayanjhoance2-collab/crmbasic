// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import UsuariosPage from "@/_Pages/usuarios/usuarios";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <UsuariosPage></UsuariosPage>
      </ClienteWrapper>
    </div>
  );
}
