// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import AdminLogin from "@/_Pages/admin/admin";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <AdminLogin></AdminLogin>
      </ClienteWrapper>
    </div>
  );
}
