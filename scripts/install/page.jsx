"use client";
import { useState } from "react";
import api from "../../../../utils/api";
import { useRouter } from "next/navigation";

export default function AffiliateOnboardingStart() {
  const router = useRouter();
  const [data, setData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    address: "",
    country: "FR",
    iban: "",
  });
  const [loading, setLoading] = useState(false);

  const update = (e) => setData({ ...data, [e.target.name]: e.target.value });

  const submit = async () => {
    setLoading(true);
    try {
      // 1. Create affiliate locally
      const res = await api.post("/api/affiliate/register", data);
      const affiliate = res.data.affiliate;

      // 2. Start stripe connect onboarding
      const onboard = await api.post("/api/affiliate/connect/create", {
        country: data.country,
        return_url: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/affiliate/onboard/complete?affiliateId=${affiliate.id}`,
        refresh_url: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/affiliate/onboard/start`,
      });

      window.location.href = onboard.data.url;
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Erreur lors de l'onboarding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Création de compte affilié</h2>

      <div className="grid grid-cols-1 gap-3">
        <input name="firstname" placeholder="Prénom" className="input" onChange={update} />
        <input name="lastname" placeholder="Nom" className="input" onChange={update} />
        <input name="email" placeholder="Email" className="input" onChange={update} />
        <input name="phone" placeholder="Téléphone" className="input" onChange={update} />
        <input name="address" placeholder="Adresse complète" className="input" onChange={update} />
        <input name="iban" placeholder="IBAN (optionnel, Stripe vérifiera)" className="input" onChange={update} />
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="mt-5 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        {loading ? "Création en cours..." : "Démarrer l'onboarding Stripe"}
      </button>
    </div>
  );
}
