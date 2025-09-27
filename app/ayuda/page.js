// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import AyudaPage from "@/_Pages/ayuda/ayuda";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <AyudaPage></AyudaPage>
      </ClienteWrapper>
    </div>
  );
}
