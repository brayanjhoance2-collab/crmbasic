// app/page.js
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import DashboardPage from "@/_Pages/dashboard/dashboard";
export default function page() {
  return (
    <div>
      <ClienteWrapper>
        <DashboardPage></DashboardPage>
      </ClienteWrapper>
    </div>
  );
}
