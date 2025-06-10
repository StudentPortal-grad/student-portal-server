import { Router } from 'express';
import { sendFriendRequest, getFriendRequests, acceptFriendRequest, rejectFriendRequest, getFriends, deleteFriend } from '../../../controllers/friend.controller';

const router = Router();

// Send friend request
router.post('/', sendFriendRequest);

// Get friend requests
router.get('/requests', getFriendRequests);

// Accept friend request
router.post('/requests/:senderId/accept', acceptFriendRequest);

// Reject friend request
router.delete('/requests/:senderId', rejectFriendRequest);

// Get friends list
router.get('/', getFriends);

// Delete a friend and their DM conversation
router.delete('/:friendId', deleteFriend);

export default router;
