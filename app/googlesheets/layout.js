// app/(main)/layout.jsx
import ClienteWrapper from "@/_EXTRAS/LadoCliente/ClienteWraper";
import HeaderMain from "@/_Pages/Main/Header/header";
import FooterMain from "@/_Pages/Main/Footer/footer";
//import CrearAdministradorInicial from "@/_EXTRAS/Crear/crear";

export default function MainLayout({ children }) {
  return (
    <>
          {
      /*
      
              <div>
                <ClienteWrapper>
                  <CrearAdministradorInicial></CrearAdministradorInicial>
                </ClienteWrapper>
              </div>
      */
          }
      <div>
        <ClienteWrapper>
          <HeaderMain></HeaderMain>
        </ClienteWrapper>
      </div>
      {children}
      <div>
        <ClienteWrapper>
          <FooterMain></FooterMain>
        </ClienteWrapper>
      </div>
    </>
  );
}