import { TransactionPayload } from '@/types/tools';
import { createToolResponse, createErrorResponse } from '@/utils/tools';
import { utils } from 'near-api-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const receiverId = searchParams.get('receiverId');
    const amount = searchParams.get('amount');

    if (!receiverId || !amount) {
      return createErrorResponse('receiverId and amount are required parameters', 400);
    }

    // Convert amount to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
    const amountInYoctoNEAR = utils.format.parseNearAmount(amount);

    if (!amountInYoctoNEAR) {
      return createErrorResponse('Invalid amount', 400);
    }

    const transactionPayload: TransactionPayload = {
      receiverId,
      actions: [
        {
          type: 'Transfer',
          params: {
            deposit: amountInYoctoNEAR,
          },
        },
      ],
    };

    return createToolResponse<{ transactionPayload: TransactionPayload }>({ transactionPayload });
  } catch (error) {
    console.error('Error generating NEAR transaction payload:', error);
    return createErrorResponse('Failed to generate NEAR transaction payload', 500);
  }
}
