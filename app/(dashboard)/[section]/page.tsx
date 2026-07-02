import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageIcon } from "@/components/icons";

const sections = {
  coletas: {
    title: "Coletas",
    description: "Cadastre, acompanhe e gerencie todas as coletas da operação.",
  },
  agenda: {
    title: "Agenda",
    description: "Visualize os compromissos e organize a programação das equipes.",
  },
  rotas: {
    title: "Rotas",
    description: "Planeje trajetos e acompanhe o deslocamento das coletas.",
  },
  equipes: {
    title: "Equipes",
    description: "Organize responsáveis, permissões e disponibilidade.",
  },
  relatorios: {
    title: "Relatórios",
    description: "Analise indicadores e resultados da operação.",
  },
  configuracoes: {
    title: "Configurações",
    description: "Personalize os dados e preferências do sistema.",
  },
} as const;

type Section = keyof typeof sections;
type PageProps = { params: Promise<{ section: string }> };

function isSection(value: string): value is Section {
  return value in sections;
}

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section } = await params;
  return isSection(section) ? { title: sections[section].title } : {};
}

export default async function SectionPage({ params }: PageProps) {
  const { section } = await params;
  if (!isSection(section)) notFound();

  const content = sections[section];

  return (
    <div className="page-container">
      <section>
        <p className="eyebrow">Módulo</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{content.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{content.description}</p>
      </section>
      <section className="panel grid min-h-72 place-items-center p-8 text-center">
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <PackageIcon className="size-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">Estrutura pronta para evoluir</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Este módulo já está integrado ao layout. As regras de negócio e os dados podem ser adicionados aqui sem alterar a navegação global.
          </p>
        </div>
      </section>
    </div>
  );
}
