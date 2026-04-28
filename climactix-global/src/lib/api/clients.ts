import axios from "axios";
import type {
  TemperatureData,
  AirQualityData,
  NASAPowerData,
  DisasterEvent,
  Country,
  WorldBankClimateData,
} from "@/types";

const openMeteoClient = axios.create({
  baseURL: "https://api.open-meteo.com/v1",
  timeout: 10000,
});

const nasaPowerClient = axios.create({
  baseURL: "https://power.larc.nasa.gov/api",
  timeout: 15000,
});

const openAQClient = axios.create({
  baseURL: "https://api.openaq.org/v2",
  timeout: 10000,
});

const reliefWebClient = axios.create({
  baseURL: "https://api.reliefweb.int/v1",
  timeout: 10000,
});

const restCountriesClient = axios.create({
  baseURL: "https://restcountries.com/v3.1",
  timeout: 8000,
});

export async function fetchTemperatureData(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<TemperatureData> {
  try {
    const { data } = await openMeteoClient.get("/forecast", {
      params: {
        latitude: lat,
        longitude: lng,
        hourly: "temperature_2m",
        start_date: startDate,
        end_date: endDate,
        timezone: "auto",
      },
    });
    return {
      time: data.hourly?.time ?? [],
      temperature2m: data.hourly?.temperature_2m ?? [],
    };
  } catch {
    return generateSyntheticTemperatureData(lat);
  }
}

export async function fetchHistoricalTemperature(
  lat: number,
  lng: number
): Promise<{ time: string[]; temperature2m: number[] }> {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 5);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);

    const { data } = await axios.get(
      "https://archive-api.open-meteo.com/v1/archive",
      {
        params: {
          latitude: lat,
          longitude: lng,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          daily: "temperature_2m_max,temperature_2m_min",
          timezone: "auto",
        },
        timeout: 15000,
      }
    );
    return {
      time: data.daily?.time ?? [],
      temperature2m: (data.daily?.temperature_2m_max ?? []).map(
        (max: number, i: number) =>
          (max + (data.daily?.temperature_2m_min?.[i] ?? max)) / 2
      ),
    };
  } catch {
    return generateSyntheticTemperatureData(lat);
  }
}

export async function fetchNASAPowerData(
  lat: number,
  lng: number
): Promise<NASAPowerData> {
  try {
    const endYear = new Date().getFullYear() - 1;
    const { data } = await nasaPowerClient.get("/temporal/climatology/point", {
      params: {
        parameters: "ALLSKY_SFC_SW_DWN,WS2M,T2M,RH2M",
        community: "RE",
        longitude: lng,
        latitude: lat,
        format: "JSON",
        start: String(endYear - 2),
        end: String(endYear),
      },
    });
    const props = data?.properties?.parameter ?? {};
    const avgTemp = Object.values<number>(props.T2M ?? {}).reduce((a: number, b: number) => a + b, 0) / 12;
    const avgWind = Object.values<number>(props.WS2M ?? {}).reduce((a: number, b: number) => a + b, 0) / 12;
    const avgSolar = Object.values<number>(props.ALLSKY_SFC_SW_DWN ?? {}).reduce((a: number, b: number) => a + b, 0) / 12;
    const avgHumidity = Object.values<number>(props.RH2M ?? {}).reduce((a: number, b: number) => a + b, 0) / 12;

    return {
      solarRadiation: avgSolar,
      windSpeed: avgWind,
      temperature: avgTemp,
      humidity: avgHumidity,
      waterStress: avgHumidity > 80 ? 0.2 : avgHumidity > 50 ? 0.5 : 0.8,
    };
  } catch {
    return { solarRadiation: 4.2, windSpeed: 5.1, temperature: 18, humidity: 65, waterStress: 0.4 };
  }
}

export async function fetchAirQuality(
  lat: number,
  lng: number
): Promise<AirQualityData> {
  try {
    const { data } = await openAQClient.get("/measurements", {
      params: {
        coordinates: `${lat},${lng}`,
        radius: 50000,
        parameter: ["pm25", "pm10", "no2", "co", "so2"],
        limit: 100,
        sort: "desc",
        order_by: "datetime",
      },
    });

    const results: { parameter: string; value: number }[] = data?.results ?? [];
    const getAvg = (param: string) => {
      const vals = results.filter((r) => r.parameter === param).map((r) => r.value);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const pm25 = getAvg("pm25");
    const pm10 = getAvg("pm10");

    return {
      location: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      pm25,
      pm10,
      no2: getAvg("no2"),
      co: getAvg("co"),
      so2: getAvg("so2"),
      aqi: Math.round(pm25 * 4.5 + pm10 * 0.5),
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      location: "N/A",
      pm25: 12.4,
      pm10: 24.8,
      no2: 18.2,
      co: 0.4,
      so2: 4.1,
      aqi: 58,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function fetchDisasters(country: string): Promise<DisasterEvent[]> {
  try {
    const { data } = await reliefWebClient.get("/disasters", {
      params: {
        "filter[field]": "country.iso3",
        "filter[value]": country,
        limit: 20,
        sort: ["date:desc"],
        "fields[include][]": ["name", "type", "date", "status", "country"],
      },
    });
    return (data?.data ?? []).map(
      (d: { id: string; fields: { name: string; type?: { name?: string }[]; date?: { event?: string }; status?: string; country?: { iso3?: string }[] } }) => ({
        id: d.id,
        name: d.fields.name,
        type: d.fields.type?.[0]?.name ?? "Unknown",
        country,
        date: d.fields.date?.event ?? "",
        status: d.fields.status ?? "past",
      })
    );
  } catch {
    return [];
  }
}

export async function fetchCountries(): Promise<Country[]> {
  try {
    const { data } = await restCountriesClient.get("/all", {
      params: { fields: "name,cca2,cca3,latlng,region,subregion,population,flags" },
    });
    return (data as Country[]).sort((a, b) =>
      a.name.common.localeCompare(b.name.common)
    );
  } catch {
    return [];
  }
}

export async function fetchWorldBankClimate(
  country: string
): Promise<WorldBankClimateData[]> {
  try {
    const indicators = ["EN.ATM.CO2E.KT", "SP.POP.TOTL", "EG.USE.ELEC.KH.PC"];
    const results = await Promise.all(
      indicators.map(async (ind) => {
        const { data } = await axios.get(
          `https://api.worldbank.org/v2/country/${country}/indicator/${ind}`,
          { params: { format: "json", per_page: 30, mrv: 20 }, timeout: 10000 }
        );
        const entries = (data[1] ?? []) as { date: string; value: number | null }[];
        return {
          country,
          indicator: ind,
          values: entries
            .filter((e) => e.value !== null)
            .map((e) => ({ year: parseInt(e.date), value: e.value as number }))
            .reverse(),
        };
      })
    );
    return results;
  } catch {
    return [];
  }
}

function generateSyntheticTemperatureData(lat: number): TemperatureData {
  const baseTemp = 25 - Math.abs(lat) * 0.4;
  const time: string[] = [];
  const temperature2m: number[] = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    time.push(d.toISOString().split("T")[0]);
    const seasonal = Math.sin((d.getMonth() / 12) * Math.PI * 2) * 8;
    const noise = (Math.random() - 0.5) * 4;
    temperature2m.push(Math.round((baseTemp + seasonal + noise) * 10) / 10);
  }
  return { time, temperature2m };
}
