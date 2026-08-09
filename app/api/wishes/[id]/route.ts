import { NextRequest, NextResponse } from "next/server";
import { supabaseRequest } from "../supabase";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

export async function DELETE(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();

    if (!id || !deviceId) {
      return NextResponse.json(
        {
          error: "Wish id and device id are required",
        },
        {
          status: 400,
        }
      );
    }

    await supabaseRequest(
      `wishes?id=eq.${encodeFilter(id)}&device_id=eq.${encodeFilter(
        deviceId
      )}`,
      {
        method: "DELETE",
      }
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("WANT wishes DELETE error:", error);

    return NextResponse.json(
      {
        error: "Failed to remove wish",
      },
      {
        status: 500,
      }
    );
  }
}
