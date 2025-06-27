import axios from "axios";
import { GoPlusTokenData } from "./types";

export async function getGoPlusSecurity(address: string): Promise<GoPlusTokenData> {
    try {
        const resp = await axios.get(
            `https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${address}`
        );
        return resp.data?.result?.[address.toLowerCase()] || {};
    } catch (e) {
        console.error("GoPlus API error:", e);
        return {};
    }
} 