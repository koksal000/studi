
"use client"; // Added to make this a Client Component

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { POPULATION_DATA, VILLAGE_NAME, ECONOMY_DATA, STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants'; // Changed GALLERY_IMAGES to STATIC_GALLERY_IMAGES_FOR_SEEDING
import Image from 'next/image';
import { BarChart as BarChartIconLucide, LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react'; // Renamed BarChart to avoid conflict
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
// Updated Recharts import
import { Bar, Line, Pie, Cell, CartesianGrid, XAxis, YAxis, LineChart, PieChart, BarChart } from 'recharts'; // Ensured LineChart, PieChart and BarChart are imported

const chartConfigPopulation = {
  population: {
    label: "Nüfus",
    color: "hsl(var(--chart-1))",
  },
};

const chartConfigEconomy = {
  tarim: { label: "Tarım", color: "hsl(var(--chart-1))" },
  hayvancilik: { label: "Hayvancılık", color: "hsl(var(--chart-2))" },
  esnaf: { label: "Esnaf", color: "hsl(var(--chart-3))" },
  diger: { label: "Diğer", color: "hsl(var(--chart-4))" },
};
const economyDataForChart = [
  { name: 'Tarım', value: 45, fill: 'hsl(var(--chart-1))' },
  { name: 'Hayvancılık', value: 30, fill: 'hsl(var(--chart-2))' },
  { name: 'Esnaf', value: 15, fill: 'hsl(var(--chart-3))' },
  { name: 'Diğer', value: 10, fill: 'hsl(var(--chart-4))' },
];


export default function AboutPage() {
  return (
    <div className="space-y-8 content-page">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">{VILLAGE_NAME} Hakkında</CardTitle>
          <CardDescription className="text-lg">
            Köyümüzün genel özellikleri, nüfusu ve ekonomisi hakkında bilgiler.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-foreground/90">
            Çamlıca Köyü, Kütahya ilinin Domaniç ilçesine bağlı, doğal güzellikleri ve zengin tarihi ile öne çıkan bir yerleşim yeridir. İlçe merkezine 8 km, il merkezine ise 85 km uzaklıkta bulunmaktadır. Deniz seviyesinden yüksekliği (rakım) 800 metredir.
          </p>
          <p className="text-foreground/90">
            Köyümüz, Domaniç&apos;in merkezi konumunda olup, çevresindeki diğer köylere ulaşım açısından önemli bir geçiş noktasıdır. Yaklaşık 20 km²&apos;lik bir alana yayılan Çamlıca, İstanbul&apos;un Fatih ilçesinden bile daha geniş bir yüzölçümüne sahiptir. Bu geniş arazi, tarım ve hayvancılık faaliyetleri için elverişli koşullar sunmaktadır.
          </p>
           <div className="grid md:grid-cols-2 gap-6 items-start">
            <div>
                <h3 className="text-xl font-semibold text-primary mb-2">Coğrafi Konum ve Özellikler</h3>
                <ul className="list-disc list-inside space-y-1 text-foreground/80">
                    <li>İl: Kütahya</li>
                    <li>İlçe: Domaniç</li>
                    <li>İlçe Merkezine Uzaklık: 8 km</li>
                    <li>İl Merkezine Uzaklık: 85 km</li>
                    <li>Rakım: 800 metre</li>
                    <li>Yüzölçümü: Yaklaşık 20 km²</li>
                </ul>
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden shadow-md">
                 <Image src={STATIC_GALLERY_IMAGES_FOR_SEEDING[1].src} alt={STATIC_GALLERY_IMAGES_FOR_SEEDING[1].alt} layout="fill" objectFit="cover" data-ai-hint={STATIC_GALLERY_IMAGES_FOR_SEEDING[1].hint || "satellite aerial"} />
            </div>
           </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><LineChartIcon className="mr-2 h-6 w-6 text-primary" />Nüfus Gelişimi</CardTitle>
          <CardDescription>Yıllara göre köyümüzün nüfus değişimi.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfigPopulation} className="h-[300px] w-full">
            {/* Removed redundant ResponsiveContainer */}
            <LineChart data={POPULATION_DATA.datasets[0].data.map((val, index) => ({ year: POPULATION_DATA.labels[index], population: val }))} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="population" stroke={chartConfigPopulation.population.color} strokeWidth={2} dot={{ r: 4, fill: chartConfigPopulation.population.color }} activeDot={{r: 6}} name="Nüfus" />
               <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
               <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
               <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={['dataMin - 50', 'dataMax + 50']} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><PieChartIcon className="mr-2 h-6 w-6 text-primary" />Ekonomik Yapı</CardTitle>
          <CardDescription>Köyümüzdeki temel geçim kaynaklarının dağılımı.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
           <ChartContainer config={chartConfigEconomy} className="h-[350px] w-full max-w-md">
             {/* Removed redundant ResponsiveContainer */}
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={economyDataForChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-medium">
                      {`${economyDataForChart[index].name} (${(percent * 100).toFixed(0)}%)`}
                    </text>
                  );
                }}>
                {economyDataForChart.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name"/>} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><BarChartIconLucide className="mr-2 h-6 w-6 text-primary" /> Detaylı Ekonomi Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-foreground/90">
            Köy ekonomisi yaklaşık 2.6 milyon USD (90 milyon TL) civarındadır. Kişi başına düşen gelir yaklaşık 238,000 TL olup, bu rakam Türkiye standartlarının altındadır. Ancak, bu duruma rağmen Çamlıca, Domaniç ilçesindeki diğer birçok köye kıyasla ekonomik olarak daha iyi bir konumdadır.
            </p>
             <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="relative aspect-video rounded-lg overflow-hidden shadow-md">
                    <Image src={STATIC_GALLERY_IMAGES_FOR_SEEDING[7].src} alt={STATIC_GALLERY_IMAGES_FOR_SEEDING[7].alt} layout="fill" objectFit="cover" data-ai-hint={STATIC_GALLERY_IMAGES_FOR_SEEDING[7].hint || "village nature"} />
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-sm text-center">Tarım Faaliyetleri</div>
                </div>
                <div className="relative aspect-video rounded-lg overflow-hidden shadow-md">
                    <Image src={STATIC_GALLERY_IMAGES_FOR_SEEDING[6].src} alt={STATIC_GALLERY_IMAGES_FOR_SEEDING[6].alt} layout="fill" objectFit="cover" data-ai-hint={STATIC_GALLERY_IMAGES_FOR_SEEDING[6].hint || "village road"} />
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-sm text-center">Hayvancılık Faaliyetleri</div>
                </div>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}

