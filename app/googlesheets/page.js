// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import GoogleSheetsPage from "@/_Pages/googlesheet/googlesheet";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <GoogleSheetsPage></GoogleSheetsPage>
      </ClienteWrapper>
    </div>
  );
}
