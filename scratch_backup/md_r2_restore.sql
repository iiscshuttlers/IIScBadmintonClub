-- MD Round 2 results from PDF screenshots (30-point game)
-- Number shown in PDF = loser's score, winner always gets 30

-- MD_R2_01: Vivek Kumar & KOTA (side1, orange winner) vs Winner of MD_R1_02 (Manikya showed 13)
UPDATE public.tournament_matches SET
  winner_side=1, winner_id='a0f0ae57-107d-4ca3-8e08-c046924a225d',
  score='30-13', sets_history=ARRAY['30-13'], status='completed', locked=true
WHERE match_code='MD_R2_01' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_02: Manu Y & MIDHUN (side1, showed 20) vs Neerav Gupta (side2, orange winner) → 20-30
UPDATE public.tournament_matches SET
  winner_side=2, winner_id='83b34e25-e1b2-49c4-8230-047e1eb57c8d',
  score='20-30', sets_history=ARRAY['20-30'], status='completed', locked=true
WHERE match_code='MD_R2_02' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_03: Rahul Singh & Chethan (side1, orange winner) vs Shyam & Shashwat (showed 12) → 30-12
UPDATE public.tournament_matches SET
  winner_side=1, winner_id='bab8f75a-49bd-4d9a-8cdc-eca5371147e0',
  score='30-12', sets_history=ARRAY['30-12'], status='completed', locked=true
WHERE match_code='MD_R2_03' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_05: Anshul Kabra & Aneesh varla (side1, orange winner) vs saisumanth (showed 12) → 30-12
UPDATE public.tournament_matches SET
  winner_side=1, winner_id='8b54025f-6d1c-42e7-8a03-dbd0bc712b0b',
  score='30-12', sets_history=ARRAY['30-12'], status='completed', locked=true
WHERE match_code='MD_R2_05' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_06: Adithya Raman Ch (side1, showed 21) vs Alin Anto & Santanu (side2, orange winner) → 21-30
UPDATE public.tournament_matches SET
  winner_side=2, winner_id='321162f5-8a04-4012-b301-b92a6bbeaad1',
  score='21-30', sets_history=ARRAY['21-30'], status='completed', locked=true
WHERE match_code='MD_R2_06' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_07: Satyam Panchal & Anjan (side1, orange winner) vs Gyanendra Kumar (showed 29) → 30-29
UPDATE public.tournament_matches SET
  winner_side=1, winner_id='1583fa01-cd74-4403-9730-aeb93139a491',
  score='30-29', sets_history=ARRAY['30-29'], status='completed', locked=true
WHERE match_code='MD_R2_07' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_08: anudeep kanna & Sandharbh (side1, showed 23) vs Manish Mandal & Raja (side2, orange winner) → 23-30
UPDATE public.tournament_matches SET
  winner_side=2, winner_id='1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b',
  score='23-30', sets_history=ARRAY['23-30'], status='completed', locked=true
WHERE match_code='MD_R2_08' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_09: Kaustav Basumatary (side1, orange winner) vs Bibin Baby & Gopikrishnan (showed 6) → 30-6
UPDATE public.tournament_matches SET
  winner_side=1, winner_id='276f1902-112c-4c71-9287-831dd1f403f2',
  score='30-6', sets_history=ARRAY['30-6'], status='completed', locked=true
WHERE match_code='MD_R2_09' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_10: Purushotam & Geddam (side1, showed 8) vs Uday regon (side2, orange winner) → 8-30
UPDATE public.tournament_matches SET
  winner_side=2, winner_id='f441a9ca-c7ef-4762-b710-955dd2beadfd',
  score='8-30', sets_history=ARRAY['8-30'], status='completed', locked=true
WHERE match_code='MD_R2_10' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_11: Kurlapalli Manjunath (side1, orange winner) vs Taras Mandi & Soumalya (showed 16) → 30-16
UPDATE public.tournament_matches SET
  winner_side=1, winner_id='92ee39c3-98cf-4667-bbcc-a15a1341a915',
  score='30-16', sets_history=ARRAY['30-16'], status='completed', locked=true
WHERE match_code='MD_R2_11' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_12: Anurag Tamuli (side1, showed 21) vs Shrihari D. Katti & Anudeep (side2, orange winner) → 21-30
UPDATE public.tournament_matches SET
  winner_side=2, winner_id='dde1dd29-31c8-4186-b4a9-771ecd2707c3',
  score='21-30', sets_history=ARRAY['21-30'], status='completed', locked=true
WHERE match_code='MD_R2_12' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_13: Abhishek Sampath (side1, orange winner) vs Santanu Kundu & Abhinay (showed 29) → 30-29
UPDATE public.tournament_matches SET
  winner_side=1, winner_id='170b1ca5-51ce-4b78-b6ea-f5087702e9f5',
  score='30-29', sets_history=ARRAY['30-29'], status='completed', locked=true
WHERE match_code='MD_R2_13' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_14: Chandraprakash & Pramay (side1, showed 16) vs Bramha Dutt Vishwakarma (side2, orange winner) → 16-30
UPDATE public.tournament_matches SET
  winner_side=2, winner_id='269983d8-b57a-45a5-a786-708ba2bbb267',
  score='16-30', sets_history=ARRAY['16-30'], status='completed', locked=true
WHERE match_code='MD_R2_14' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R2_16: Joban Preet & Pranav (side1, showed 13) vs Piyush Tiwary & Varun (side2, orange winner) → 13-30
UPDATE public.tournament_matches SET
  winner_side=2, winner_id='0283fa29-a219-42a0-8440-7b905b8c8756',
  score='13-30', sets_history=ARRAY['13-30'], status='completed', locked=true
WHERE match_code='MD_R2_16' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';
