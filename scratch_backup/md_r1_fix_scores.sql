-- Fix MD R1 scores: winner always gets 30, number shown is LOSER's score
-- score format: team1_score-team2_score

-- MD_R1_02: Ashwinth (side1) wins, Tanay showed 17 → 30-17
UPDATE public.tournament_matches SET score='30-17', sets_history=ARRAY['30-17'] WHERE match_code='MD_R1_02' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_03: Manu Y (side1) wins, Sriram showed 18 → 30-18
UPDATE public.tournament_matches SET score='30-18', sets_history=ARRAY['30-18'] WHERE match_code='MD_R1_03' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_04: Neerav (side2) wins, Shubham showed 28 → 28-30
UPDATE public.tournament_matches SET score='28-30', sets_history=ARRAY['28-30'] WHERE match_code='MD_R1_04' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_06: Shyam (side1) wins, Shyamal showed 21 → 30-21
UPDATE public.tournament_matches SET score='30-21', sets_history=ARRAY['30-21'] WHERE match_code='MD_R1_06' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_07: Arul Anand (side2) wins, Akshat showed 12 → 12-30
UPDATE public.tournament_matches SET score='12-30', sets_history=ARRAY['12-30'] WHERE match_code='MD_R1_07' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_10: saisumanth (side2) wins, Sakthivel showed 6 → 6-30
UPDATE public.tournament_matches SET score='6-30', sets_history=ARRAY['6-30'] WHERE match_code='MD_R1_10' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_11: Vikrant (side1) wins, Shyaam showed 13 → 30-13
UPDATE public.tournament_matches SET score='30-13', sets_history=ARRAY['30-13'] WHERE match_code='MD_R1_11' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_13: Anjan (side1) wins, Anant showed 8 → 30-8
UPDATE public.tournament_matches SET score='30-8', sets_history=ARRAY['30-8'] WHERE match_code='MD_R1_13' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_14: Gyanendra (side2) wins, Shreenath showed 0 → 0-30
UPDATE public.tournament_matches SET score='0-30', sets_history=ARRAY['0-30'] WHERE match_code='MD_R1_14' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_15: Sandharbh (side1) wins, Utkarsh showed 26 → 30-26
UPDATE public.tournament_matches SET score='30-26', sets_history=ARRAY['30-26'] WHERE match_code='MD_R1_15' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_18: Bibin Baby (side1) wins, Shaik showed 0 → 30-0
UPDATE public.tournament_matches SET score='30-0', sets_history=ARRAY['30-0'] WHERE match_code='MD_R1_18' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_19: Purushotam (side2) wins, Venkata showed 0 → 0-30
UPDATE public.tournament_matches SET score='0-30', sets_history=ARRAY['0-30'] WHERE match_code='MD_R1_19' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_20: Uday regon (side2) wins, Deepanshu showed 8 → 8-30
UPDATE public.tournament_matches SET score='8-30', sets_history=ARRAY['8-30'] WHERE match_code='MD_R1_20' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_22: Taras Mandi (side2) wins, Teja showed 25 → 25-30
UPDATE public.tournament_matches SET score='25-30', sets_history=ARRAY['25-30'] WHERE match_code='MD_R1_22' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_23: Anurag Tamuli (side1) wins, Rizwan showed 14 → 30-14
UPDATE public.tournament_matches SET score='30-14', sets_history=ARRAY['30-14'] WHERE match_code='MD_R1_23' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_26: Santanu Kundu (side1) wins, Nikhil showed 24 → 30-24
UPDATE public.tournament_matches SET score='30-24', sets_history=ARRAY['30-24'] WHERE match_code='MD_R1_26' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_27: Chandraprakash (side1) wins, Arhat showed 22 → 30-22
UPDATE public.tournament_matches SET score='30-22', sets_history=ARRAY['30-22'] WHERE match_code='MD_R1_27' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_30: Moulik Ketkar (side2) wins, Kavin showed 0 → 0-30
UPDATE public.tournament_matches SET score='0-30', sets_history=ARRAY['0-30'] WHERE match_code='MD_R1_30' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';

-- MD_R1_31: Pranav & Joban Preet (side1) wins, Ahaan showed 18 → 30-18
UPDATE public.tournament_matches SET score='30-18', sets_history=ARRAY['30-18'] WHERE match_code='MD_R1_31' AND tournament_id='62c5341c-df12-4511-9253-a9a0e9546667';
