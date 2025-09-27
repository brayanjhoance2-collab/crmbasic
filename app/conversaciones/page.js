// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import ConversacionesPage from "@/_Pages/conversacion/conversaciones";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <ConversacionesPage></ConversacionesPage>
      </ClienteWrapper>
    </div>
  );
}
