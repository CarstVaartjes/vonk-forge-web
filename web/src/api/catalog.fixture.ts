// Real catalog entries for the tests, declared against the generated contract types so a
// field the schema does not have fails `tsc`. The four recipes and their models are copied
// verbatim from the signed v4.7.0 library index served at https://vonkforge.ai/catalog;
// `vocabulary` is the one the contract publishes from v4.8.0 (CatalogIndex.vocabulary).
// Recipes: two single-Spark Working recipes of one model (gemma-4-e2b), a Working 3D
// recipe, and an eight-Spark recipe that is Not yet verified for needing more Sparks.
import type { CatalogIndex } from "./catalog-types";

export const catalogIndexFixture = {
  "schema_version": 2,
  "kind": "recipe-library-index",
  "contract_version": "4.8.0",
  "updated_at": "2026-11-12T10:23:34Z",
  "repository": "CarstVaartjes/vonk-forge-recipes",
  "source_commit": "7ef04e5f587125b4a8a16c2e122c80c5a1951a3a",
  "package_contract": {
    "media_type": "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
    "metadata_fields": [
      "path",
      "media_type",
      "sha256",
      "expected_bytes",
      "recipe_content_sha256",
      "minimum_consumer_schema",
      "source_bundle_sha256"
    ],
    "path_prefix": "packages/",
    "schema_version": 2
  },
  "vocabulary": {
    "capabilities": [
      {
        "category": "3d",
        "description": "Creates 3D assets such as meshes from text or images.",
        "label": "3D generation",
        "name": "3d-generation"
      },
      {
        "category": "audio",
        "description": "Creates music or sound.",
        "label": "Audio generation",
        "name": "audio-generation"
      },
      {
        "category": "audio",
        "description": "Takes audio as input and answers about it.",
        "label": "Audio understanding",
        "name": "audio-understanding"
      },
      {
        "category": "language",
        "description": "Holds a conversation in turns.",
        "label": "Chat",
        "name": "chat"
      },
      {
        "category": "code",
        "description": "Writes and edits program code.",
        "label": "Code generation",
        "name": "code-generation"
      },
      {
        "category": "other",
        "description": "Chooses between options and returns the choice.",
        "label": "Decision",
        "name": "decision"
      },
      {
        "category": "image",
        "description": "Changes an existing image from an instruction.",
        "label": "Image editing",
        "name": "image-editing"
      },
      {
        "category": "image",
        "description": "Creates images from text.",
        "label": "Image generation",
        "name": "image-generation"
      },
      {
        "category": "vision",
        "description": "Takes images as input and answers about them.",
        "label": "Image understanding",
        "name": "image-understanding"
      },
      {
        "category": "image",
        "description": "Raises the resolution of an image.",
        "label": "Image upscaling",
        "name": "image-upscaling"
      },
      {
        "category": "3d",
        "description": "Estimates surface materials of a 3D asset or image.",
        "label": "Material estimation",
        "name": "material-estimation"
      },
      {
        "category": "3d",
        "description": "Recovers body motion from video.",
        "label": "Motion capture",
        "name": "motion-capture"
      },
      {
        "category": "3d",
        "description": "Creates character motion from text.",
        "label": "Motion generation",
        "name": "motion-generation"
      },
      {
        "category": "vision",
        "description": "Reads text from images and documents.",
        "label": "OCR",
        "name": "ocr"
      },
      {
        "category": "3d",
        "description": "Represents a human body by shape and pose parameters.",
        "label": "Parametric body model",
        "name": "parametric-body-model"
      },
      {
        "category": "vision",
        "description": "Finds people in images or video.",
        "label": "Person detection",
        "name": "person-detection"
      },
      {
        "category": "language",
        "description": "Works through a problem in steps before answering.",
        "label": "Reasoning",
        "name": "reasoning"
      },
      {
        "category": "language",
        "description": "A draft model that speeds up another model's text generation.",
        "label": "Speculative decoding",
        "name": "speculative-decoding"
      },
      {
        "category": "audio",
        "description": "Turns speech into text.",
        "label": "Speech recognition",
        "name": "speech-recognition"
      },
      {
        "category": "language",
        "description": "Continues or writes text from a prompt.",
        "label": "Text generation",
        "name": "text-generation"
      },
      {
        "category": "audio",
        "description": "Speaks text aloud.",
        "label": "Text to speech",
        "name": "text-to-speech"
      },
      {
        "category": "language",
        "description": "Calls functions or tools you describe.",
        "label": "Tool use",
        "name": "tool-use"
      },
      {
        "category": "video",
        "description": "Creates video clips.",
        "label": "Video generation",
        "name": "video-generation"
      },
      {
        "category": "vision",
        "description": "Takes video as input and answers about it.",
        "label": "Video understanding",
        "name": "video-understanding"
      },
      {
        "category": "audio",
        "description": "Speaks in the voice of a reference recording.",
        "label": "Voice cloning",
        "name": "voice-cloning"
      },
      {
        "category": "audio",
        "description": "Creates a new voice from a description.",
        "label": "Voice design",
        "name": "voice-design"
      }
    ],
    "categories": [
      {
        "id": "language",
        "label": "Language"
      },
      {
        "id": "code",
        "label": "Code"
      },
      {
        "id": "vision",
        "label": "Vision"
      },
      {
        "id": "image",
        "label": "Image"
      },
      {
        "id": "video",
        "label": "Video"
      },
      {
        "id": "audio",
        "label": "Audio"
      },
      {
        "id": "3d",
        "label": "3D"
      },
      {
        "id": "other",
        "label": "Other"
      }
    ],
    "statuses": [
      {
        "meaning": "Passed on a real DGX Spark for this exact recipe, runtime image and model.",
        "status": "Working",
        "verified": true
      },
      {
        "meaning": "Passed before, but the recipe, image or model has changed since.",
        "status": "Re-check: worked before",
        "verified": false
      },
      {
        "meaning": "A recipe failure was followed by a change to the recipe, image or model.",
        "status": "Fix to verify",
        "verified": false
      },
      {
        "meaning": "Failed on a real DGX Spark with the current recipe, image and model.",
        "status": "Failed: recipe",
        "verified": false
      },
      {
        "meaning": "Could not run because of a platform fault, not because of the recipe.",
        "status": "Blocked: platform",
        "verified": false
      },
      {
        "meaning": "No hardware verdict yet.",
        "status": "Untested",
        "verified": false
      },
      {
        "meaning": "Needs more Sparks than the test fleet has.",
        "status": "Can't test here",
        "verified": false
      },
      {
        "meaning": "Being tested on hardware now; the earlier result stays visible.",
        "status": "Testing now",
        "verified": false
      },
      {
        "meaning": "No hardware verdict yet; the reason is shown under the badge.",
        "status": "Not yet verified",
        "verified": false
      }
    ]
  },
  "catalog_entities": [
    {
      "content_sha256": "8c3b7f84fa5cc8ae81e13cfeb408e29f47960016284b60d46764037c69cc2414",
      "display": {
        "capabilities": [
          "audio-understanding",
          "chat",
          "image-understanding",
          "reasoning",
          "text-generation",
          "tool-use"
        ],
        "description": "Exact public Google Gemma 4 E2B instruction-tuned checkpoint.",
        "family_title": "Google Gemma",
        "identity": {
          "publisher": "google",
          "slug": "gemma-4-e2b-it-4adf1574"
        },
        "kind": "model-display",
        "license": {
          "attribution": [
            "Google DeepMind"
          ],
          "spdx": "Apache-2.0",
          "url": "https://ai.google.dev/gemma/docs/gemma_4_license"
        },
        "modalities": [
          "audio",
          "image",
          "text"
        ],
        "model_title": "Gemma 4 E2B",
        "tags": [
          "google",
          "gemma",
          "language",
          "instruction-tuned",
          "candidate"
        ]
      },
      "document": {
        "dependencies": [],
        "files": [
          {
            "id": "metadata-34448b82c17d-618cd5b83d",
            "path": ".gitattributes",
            "roles": [
              "metadata"
            ],
            "sha256": "34448b82c17d60fec9b65b1f093c115ddbaadc04beb1b0140b6bfed2e012a930",
            "size_bytes": 1570
          },
          {
            "id": "readme-3e0608a6be80-b335630551",
            "path": "README.md",
            "roles": [
              "metadata"
            ],
            "sha256": "3e0608a6be80e3eb040a5aa6c76707809503deb85be6360184a118fb6156526c",
            "size_bytes": 27955
          },
          {
            "id": "chat-template-0a2c8073c878-00824420d1",
            "path": "chat_template.jinja",
            "roles": [
              "tokenizer"
            ],
            "sha256": "0a2c8073c878ab1da004bee933a998606537bbb62016310352c7285c3f01c5b5",
            "size_bytes": 18569
          },
          {
            "id": "config-1b28f3d2c310-587cb980af",
            "path": "config.json",
            "roles": [
              "configuration"
            ],
            "sha256": "1b28f3d2c3100f6c594754b81107428bd7b822a7f48272ca681dae9d2ec38330",
            "size_bytes": 4954
          },
          {
            "id": "generation-config-d4226bbe3117-97dd3d578b",
            "path": "generation_config.json",
            "roles": [
              "configuration"
            ],
            "sha256": "d4226bbe3117d2d253ba4609720ba82c6c4ce4627a9a6ae05387c78983ac03de",
            "size_bytes": 208
          },
          {
            "id": "model-2db5482b20d7-9d75c1098f",
            "path": "model.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "2db5482b20d746879bb3ef79b5203e9075a2e2b98f54ec7c2f281c1477ddc550",
            "size_bytes": 10246621918
          },
          {
            "id": "processor-config-32bdf45d2ad4-27f0cb76af",
            "path": "processor_config.json",
            "roles": [
              "configuration"
            ],
            "sha256": "32bdf45d2ad4cc29a0822ddd157a182de76644f0419a6228d151495256e9813c",
            "size_bytes": 1689
          },
          {
            "id": "tokenizer-ab26b2add729-224931eb13",
            "path": "tokenizer.json",
            "roles": [
              "tokenizer"
            ],
            "sha256": "ab26b2add729e6f645bd869f228f14190a06615538f3be6f7786f33d13d78ad2",
            "size_bytes": 32155733
          },
          {
            "id": "tokenizer-config-9f4fec4b1dc6-94d5c6ba8f",
            "path": "tokenizer_config.json",
            "roles": [
              "tokenizer"
            ],
            "sha256": "9f4fec4b1dc6ecddf8f4a92e9caea5971c0e67d81309f3f9066a2bee8c362633",
            "size_bytes": 3082
          }
        ],
        "format": {
          "precision": "bf16",
          "quantization": "none"
        },
        "identity": {
          "model": {
            "publisher": "google",
            "slug": "gemma-4-e2b"
          },
          "publisher": "google",
          "slug": "gemma-4-e2b-it-4adf1574",
          "variant": "IT 4adf1574",
          "version": "IT 4adf1574"
        },
        "kind": "model",
        "requires_token": false,
        "source": {
          "repository": "https://huggingface.co/google/gemma-4-E2B-it",
          "revision": "4adf15748de9e1a0097b6274cee9c15836c41c37"
        }
      },
      "source_path": "models/gemma-4-e2b-it-4adf1574.json"
    },
    {
      "content_sha256": "09b8329e18fb1932c89cec4d3f85a7000f9272b87131bd97f6eb0b4b103f876f",
      "display": {
        "capabilities": [
          "audio-understanding",
          "chat",
          "image-understanding",
          "reasoning",
          "text-generation",
          "tool-use",
          "video-understanding"
        ],
        "description": "ggml-org GGUF conversion of Gemma 4 E2B IT at Q8_0, plus the Q8_0 vision projector.",
        "family_title": "Google Gemma",
        "identity": {
          "publisher": "ggml-org",
          "slug": "gemma-4-e2b-it-q8-0-63f6c6f2"
        },
        "kind": "model-display",
        "license": {
          "attribution": [
            "Google DeepMind",
            "ggml-org"
          ],
          "spdx": "Apache-2.0",
          "url": "https://ai.google.dev/gemma/docs/gemma_4_license"
        },
        "modalities": [
          "audio",
          "image",
          "text",
          "video"
        ],
        "model_title": "Gemma 4 E2B",
        "tags": [
          "ggml-org",
          "gemma",
          "language",
          "gguf",
          "candidate"
        ]
      },
      "document": {
        "dependencies": [],
        "files": [
          {
            "id": "metadata-a1c30820b1ac-618cd5b83d",
            "path": ".gitattributes",
            "roles": [
              "metadata"
            ],
            "sha256": "a1c30820b1ac05b8b9034b034c6766e73ddd252670532598c22f116e5fc197a1",
            "size_bytes": 2479
          },
          {
            "id": "readme-9dbd5e423137-b335630551",
            "path": "README.md",
            "roles": [
              "metadata"
            ],
            "sha256": "9dbd5e42313785eae14568bc4fc45ea54fee844384636f1d3779e3e65798a37f",
            "size_bytes": 660
          },
          {
            "id": "gemma-4-e2b-it-q8-0-c36d5e6be0d9-ef5b4b1ca4",
            "path": "gemma-4-E2B-it-Q8_0.gguf",
            "roles": [
              "weights"
            ],
            "sha256": "c36d5e6be0d91124d8b995f5ad4e1ab0d307f6d95cdd08308820350dbd96ad15",
            "size_bytes": 4967491520
          },
          {
            "id": "mmproj-gemma-4-e2b-it-q8-0-042cc2561806-3412a371d8",
            "path": "mmproj-gemma-4-E2B-it-Q8_0.gguf",
            "roles": [
              "weights"
            ],
            "sha256": "042cc2561806cd3b5cb5efb25cab76911e3100c43cc09d854904f921924b1429",
            "size_bytes": 557368096
          }
        ],
        "format": {
          "precision": "mixed",
          "quantization": "gguf-q8-0"
        },
        "identity": {
          "model": {
            "publisher": "ggml-org",
            "slug": "gemma-4-e2b"
          },
          "publisher": "ggml-org",
          "slug": "gemma-4-e2b-it-q8-0-63f6c6f2",
          "variant": "IT Q8_0 63f6c6f2",
          "version": "IT Q8_0 63f6c6f2"
        },
        "kind": "model",
        "requires_token": false,
        "source": {
          "repository": "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF",
          "revision": "63f6c6f23b3e9e5f9737708daec2f88c9ac2e921"
        }
      },
      "source_path": "models/gemma-4-e2b-it-q8-0-63f6c6f2.json"
    },
    {
      "content_sha256": "3318872c643e6f5c95ed4b3fd61a79861414de5de39e1e1b5f85a719f6fd94ae",
      "display": {
        "capabilities": [
          "audio-understanding",
          "image-understanding",
          "text-generation"
        ],
        "description": "Exact public NVFP4 42a75a99 checkpoint.",
        "family_title": "Inkling",
        "identity": {
          "publisher": "thinkingmachines",
          "slug": "inkling-975b-a41b-nvfp4"
        },
        "kind": "model-display",
        "license": {
          "attribution": [
            "Thinking Machines Lab"
          ],
          "spdx": "Apache-2.0",
          "url": "https://www.apache.org/licenses/LICENSE-2.0"
        },
        "modalities": [
          "audio",
          "image",
          "text"
        ],
        "model_title": "Inkling 975B-A41B",
        "tags": [
          "thinkingmachines",
          "inkling",
          "multimodal",
          "candidate"
        ]
      },
      "document": {
        "dependencies": [],
        "files": [
          {
            "id": "metadata-deb930275aeb",
            "path": ".gitattributes",
            "roles": [
              "metadata"
            ],
            "sha256": "deb930275aebff0e044dbc7db375ee20500fba65430ce6117308598ca7662cb2",
            "size_bytes": 2441
          },
          {
            "id": "readme-2ea1315d3948",
            "path": "README.md",
            "roles": [
              "metadata"
            ],
            "sha256": "2ea1315d39486624ec2d301946abba49e9f7266ace2375336a4ac7d006eb6956",
            "size_bytes": 14081
          },
          {
            "id": "chat-template-0aa1aa0c729d",
            "path": "chat_template.jinja",
            "roles": [
              "tokenizer"
            ],
            "sha256": "0aa1aa0c729d90176dcaa00c440c8faffca2957ffb2cc4b79456ee6d02bcf43b",
            "size_bytes": 6294
          },
          {
            "id": "config-58720f145bce",
            "path": "config.json",
            "roles": [
              "configuration"
            ],
            "sha256": "58720f145bcecef9a7ab2b419ab346e7c634af8d2f3e7362e900d00f789ea46c",
            "size_bytes": 2415
          },
          {
            "id": "hf-quant-config-13277ee163a6",
            "path": "hf_quant_config.json",
            "roles": [
              "configuration"
            ],
            "sha256": "13277ee163a64a869f05c1791d21f9cf85f70e555519e2f211e77c178484256f",
            "size_bytes": 20697
          },
          {
            "id": "model-00001-of-00033-d23be7ca189d",
            "path": "model-00001-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "d23be7ca189d3474217ab8063d0153e44b04eedb9b7854db74dc0f24e4979538",
            "size_bytes": 19116985342
          },
          {
            "id": "model-00002-of-00033-41b33ae96076",
            "path": "model-00002-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "41b33ae960764a81d5b401cca3edf4c1beed9b9a8bb35e032dc8fdf3ad5cfbb4",
            "size_bytes": 19974331454
          },
          {
            "id": "model-00003-of-00033-fe781903b1bb",
            "path": "model-00003-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "fe781903b1bb876b77831fbaafd485831a97db6d878d95fd176282eaf42df303",
            "size_bytes": 19167394188
          },
          {
            "id": "model-00004-of-00033-cfd2beda8c08",
            "path": "model-00004-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "cfd2beda8c08d0c2f3f4204f982879672a67cde4ba183d082cc6df238f592f55",
            "size_bytes": 15696646890
          },
          {
            "id": "model-00005-of-00033-b19b96fb7ace",
            "path": "model-00005-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "b19b96fb7acec0e01286c63ffadbd258486d8044ae252c7af2d4b5785aa21ebc",
            "size_bytes": 17858589788
          },
          {
            "id": "model-00006-of-00033-e718c10c7770",
            "path": "model-00006-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "e718c10c7770562f87cc15bb40488a37f5ec856d3536267fc962056f0d2ed293",
            "size_bytes": 19944324836
          },
          {
            "id": "model-00007-of-00033-74fc6ed7fec4",
            "path": "model-00007-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "74fc6ed7fec4e97d7c370dac0b565d43b2b9f4c043e8770118141cfaf35c83ed",
            "size_bytes": 19208103526
          },
          {
            "id": "model-00008-of-00033-e47c3b0b413c",
            "path": "model-00008-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "e47c3b0b413c96a00dbc3b7e1bab610685addab8471f0e48952ddac0bc26af48",
            "size_bytes": 19950824732
          },
          {
            "id": "model-00009-of-00033-d07c90536ed4",
            "path": "model-00009-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "d07c90536ed495b7fac18a2a2602058b85eb93dfe88f74639927af056c62689f",
            "size_bytes": 18726640016
          },
          {
            "id": "model-00010-of-00033-1fcc29248d30",
            "path": "model-00010-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "1fcc29248d304d52ab894e76b904c15005f5dae87e5db4188b9220a3637c2fd7",
            "size_bytes": 19997716432
          },
          {
            "id": "model-00011-of-00033-6acd555f7925",
            "path": "model-00011-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "6acd555f7925e4330bf38b091f5cf67836a5611f3f8142afc7e99ed6aaa7ae5a",
            "size_bytes": 19503730654
          },
          {
            "id": "model-00012-of-00033-86d80117e4de",
            "path": "model-00012-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "86d80117e4deb8f2947c53ddc5ab35d361bb8759ad36dcdc4f1de5635aed4f46",
            "size_bytes": 15632104382
          },
          {
            "id": "model-00013-of-00033-13307919a112",
            "path": "model-00013-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "13307919a112b12452ebc78ab53b5d1ad32d82f0867e6c305f1b85aebca65676",
            "size_bytes": 18122786004
          },
          {
            "id": "model-00014-of-00033-554ea1d6bf0b",
            "path": "model-00014-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "554ea1d6bf0b84772cd0dd1d36487b7eb081528dcc79bab6ab3cba36d740a2df",
            "size_bytes": 18000161310
          },
          {
            "id": "model-00015-of-00033-9f93de27a392",
            "path": "model-00015-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "9f93de27a3928b3beb5b58bb0d00d33be91ce60ce090ede27fa29c95b4c94872",
            "size_bytes": 19849789206
          },
          {
            "id": "model-00016-of-00033-e0f295b3871f",
            "path": "model-00016-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "e0f295b3871fe4aa9be4873c11f645dd80b18be52ae6d316253448f51cb7eda1",
            "size_bytes": 19579605120
          },
          {
            "id": "model-00017-of-00033-9373b84f05de",
            "path": "model-00017-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "9373b84f05de768a6bf98c1942c016f8b0129090b0570f61dc2b6daab7777e9b",
            "size_bytes": 18349586234
          },
          {
            "id": "model-00018-of-00033-75dae1981cd6",
            "path": "model-00018-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "75dae1981cd64811ecd65d438e17ccbbdf218c3664e343a2b2de8d46d59de962",
            "size_bytes": 19542373784
          },
          {
            "id": "model-00019-of-00033-d6302d4e1c1d",
            "path": "model-00019-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "d6302d4e1c1d85de690147b90521225620c9e86bf477d7f4f0f10921d466cf9b",
            "size_bytes": 15483680186
          },
          {
            "id": "model-00020-of-00033-c1e547007ec0",
            "path": "model-00020-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "c1e547007ec0dbc44f0972666698ceb7fd71b2b2c4c0d0016c0431f00245f8d8",
            "size_bytes": 19255845282
          },
          {
            "id": "model-00021-of-00033-10ad49ad1a9f",
            "path": "model-00021-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "10ad49ad1a9f85624af04006bb16354027c6c21c7689a8602aff1487956a0e40",
            "size_bytes": 16632058036
          },
          {
            "id": "model-00022-of-00033-52e84a65712c",
            "path": "model-00022-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "52e84a65712cb045151603cec3633f6ab1ffd4c4d2584aba9bc2fdef1354f7c4",
            "size_bytes": 17755343330
          },
          {
            "id": "model-00023-of-00033-3aaf8a3bba4c",
            "path": "model-00023-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "3aaf8a3bba4c8206cb2f51011a33e46eae5063446317edf9e5edf50c8d80389f",
            "size_bytes": 17842745792
          },
          {
            "id": "model-00024-of-00033-9b889e3657ce",
            "path": "model-00024-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "9b889e3657ce1d7f8b634eb73c7e9fef75492cbcb8206ade2b1de0266590e29c",
            "size_bytes": 16021544096
          },
          {
            "id": "model-00025-of-00033-8d7577d69d5c",
            "path": "model-00025-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "8d7577d69d5c304bd98f8ac1edc7c68fcb82d807f840ec9ace23ba2cc9a96473",
            "size_bytes": 19384613910
          },
          {
            "id": "model-00026-of-00033-f00eb775e4d2",
            "path": "model-00026-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "f00eb775e4d28ec500fbba497ca5b6b862a881545f4fcc5acfc1aeae5cac2386",
            "size_bytes": 19126417732
          },
          {
            "id": "model-00027-of-00033-22006739079d",
            "path": "model-00027-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "22006739079defafd8bd3abf574f7161842f6c53cd45e3a9f7dbf5dd51b8885e",
            "size_bytes": 18252708640
          },
          {
            "id": "model-00028-of-00033-16fcb85bb6b1",
            "path": "model-00028-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "16fcb85bb6b1841a43c0c242d5192ec6297c5c5acb5637951af21c3a54e248e8",
            "size_bytes": 19645387122
          },
          {
            "id": "model-00029-of-00033-a37f89d84360",
            "path": "model-00029-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "a37f89d8436040f16473caa70677b71a4808bdc31dac357d1e7543a3f5bbec85",
            "size_bytes": 19871788438
          },
          {
            "id": "model-00030-of-00033-4afa6d80ea00",
            "path": "model-00030-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "4afa6d80ea00e395067a54c50a0498a345d6aed1c51adba4d19291f5e15ae722",
            "size_bytes": 1224040074
          },
          {
            "id": "model-00031-of-00033-a15ba8214581",
            "path": "model-00031-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "a15ba82145814f6186bda48484ef09adef7c3fc7babf740d6c50a6dab395a76b",
            "size_bytes": 19352518936
          },
          {
            "id": "model-00032-of-00033-91a6e0d6613e",
            "path": "model-00032-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "91a6e0d6613ea5051cb2e69c3d2cba9d41222d2b991b0b7f95929e6ee081ebda",
            "size_bytes": 18582473448
          },
          {
            "id": "model-00033-of-00033-de00ac84eb64",
            "path": "model-00033-of-00033.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "de00ac84eb647e310675cf9eacd84919e732e272cb9e7b356cf93c5799666993",
            "size_bytes": 4831838368
          },
          {
            "id": "model-safetensors-index-23e5784d5695",
            "path": "model.safetensors.index.json",
            "roles": [
              "configuration"
            ],
            "sha256": "23e5784d569500563c2603920d0d2e7240caab5daa627bb5928e3d092fc6e560",
            "size_bytes": 176549
          },
          {
            "id": "mtp-a0a01bf72ac4",
            "path": "mtp.safetensors",
            "roles": [
              "weights"
            ],
            "sha256": "a0a01bf72ac48c3d7bfd56d5c1efbc955f00f51db30eb0955996680d8e595cc0",
            "size_bytes": 10520911944
          },
          {
            "id": "processor-config-b4a3962ea5f7",
            "path": "processor_config.json",
            "roles": [
              "configuration"
            ],
            "sha256": "b4a3962ea5f7ec39f40b5cf14e57ce99776c3dcce4756a110f7a169809e3a04c",
            "size_bytes": 1110
          },
          {
            "id": "special-tokens-map-abc97715b4b3",
            "path": "special_tokens_map.json",
            "roles": [
              "tokenizer"
            ],
            "sha256": "abc97715b4b3b30eb65ea6895afd7b529c32bd10c28901f9ddae7edc39723b0f",
            "size_bytes": 517
          },
          {
            "id": "tokenizer-bc253fd2b702",
            "path": "tiktoken/tokenizer.model",
            "roles": [
              "tokenizer"
            ],
            "sha256": "bc253fd2b702f7a6da7105eaa8f3463b2f1247e83614f23e5323b921088bed2a",
            "size_bytes": 3615874
          },
          {
            "id": "tokenizer-9fb6333a7db8",
            "path": "tokenizer.json",
            "roles": [
              "tokenizer"
            ],
            "sha256": "9fb6333a7db8fe5da90728e741e4a3ee4ac2ae12c5dd4958cc6f31688787d3c2",
            "size_bytes": 27875797
          },
          {
            "id": "tokenizer-config-2e36c9748a20",
            "path": "tokenizer_config.json",
            "roles": [
              "tokenizer"
            ],
            "sha256": "2e36c9748a2081abb935b2e745ee22e82efa32589c2500df7e5bc0f93145cd77",
            "size_bytes": 12111
          }
        ],
        "format": {
          "precision": "mixed",
          "quantization": "nvfp4"
        },
        "identity": {
          "model": {
            "publisher": "thinkingmachines",
            "slug": "inkling-975b-a41b"
          },
          "publisher": "thinkingmachines",
          "slug": "inkling-975b-a41b-nvfp4",
          "variant": "NVFP4 42a75a99",
          "version": "NVFP4 42a75a99"
        },
        "kind": "model",
        "requires_token": false,
        "source": {
          "repository": "https://huggingface.co/thinkingmachines/Inkling-NVFP4",
          "revision": "42a75a99a40eb2ba1e0717db6357a0bf15205044"
        }
      },
      "source_path": "models/inkling-975b-a41b-nvfp4.json"
    },
    {
      "content_sha256": "a96dff28e02b7a3040a4bc4d53d0e64823a2d8f7fbb8b96e079c91fc7b9e71ab",
      "display": {
        "capabilities": [
          "3d-generation"
        ],
        "description": "Immutable public snapshot at 79736cad.",
        "family_title": "SkinTokens",
        "identity": {
          "publisher": "vast-ai",
          "slug": "skintokens"
        },
        "kind": "model-display",
        "license": {
          "attribution": [
            "vast-ai"
          ],
          "spdx": "MIT",
          "territorial_restrictions": null,
          "url": "https://github.com/VAST-AI-Research/SkinTokens/blob/273b691d35989d71cd17ff2895fdc735097b92d1/LICENSE"
        },
        "modalities": [
          "3d"
        ],
        "model_title": "SkinTokens",
        "tags": [
          "vast-ai",
          "three-d",
          "candidate"
        ]
      },
      "document": {
        "dependencies": [],
        "files": [
          {
            "id": "metadata-11ad7efa2497-618cd5b83d",
            "path": ".gitattributes",
            "roles": [
              "metadata"
            ],
            "sha256": "11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361",
            "size_bytes": 1519
          },
          {
            "id": "readme-7aadc16361d4-b335630551",
            "path": "README.md",
            "roles": [
              "metadata"
            ],
            "sha256": "7aadc16361d4c5280865d0b5163fbf77aeb3e3af439eacbf05e0a316c159c375",
            "size_bytes": 7400
          },
          {
            "id": "grpo-1400-f4e4706a11cf-0a004da47f",
            "path": "experiments/articulation_xl_quantization_256_token_4/grpo_1400.ckpt",
            "roles": [
              "weights"
            ],
            "sha256": "f4e4706a11cfb520cdde65156a0358545e4fbf8f36237aca01ea5e79d5cb5692",
            "size_bytes": 1131603979
          },
          {
            "id": "last-4843f49e58af-3417e359c3",
            "path": "experiments/skin_vae_2_10_32768/last.ckpt",
            "roles": [
              "weights"
            ],
            "sha256": "4843f49e58afff88345806b94ca82e6cc9d8def6e7432e2853c677b154de0ed4",
            "size_bytes": 487311745
          }
        ],
        "format": {
          "precision": "bf16",
          "quantization": "none"
        },
        "identity": {
          "model": {
            "publisher": "vast-ai",
            "slug": "skintokens"
          },
          "publisher": "vast-ai",
          "slug": "skintokens",
          "variant": "SkinTokens / TokenRig",
          "version": "SkinTokens / TokenRig"
        },
        "kind": "model",
        "requires_token": false,
        "source": {
          "repository": "https://huggingface.co/VAST-AI/SkinTokens",
          "revision": "79736cad0fd84de384d5eede659b4ebd24effe33"
        }
      },
      "source_path": "models/skintokens.json"
    }
  ],
  "recipes": [
    {
      "api": {
        "api": {
          "audio_output": false,
          "default_output_tokens": {
            "remaining": "context"
          },
          "endpoints": [
            "/v1/chat/completions",
            "/v1/completions",
            "/v1/responses",
            "/v1/messages"
          ],
          "input_modalities": {
            "audio": true,
            "image": true,
            "pdf": false,
            "text": true,
            "video": false
          },
          "max_input_tokens": null,
          "max_output_tokens": {
            "setting": "context_tokens"
          },
          "mode": "chat",
          "reasoning": {
            "kind": "none"
          },
          "streaming": true,
          "structured_output": true,
          "system_messages": true,
          "tools": {
            "kind": "none"
          }
        },
        "identity": {
          "publisher": "vonk-forge",
          "slug": "gemma-4-e2b-it-nvidia-vllm-single"
        },
        "kind": "recipe-api",
        "option_choices": []
      },
      "content_sha256": "500d52be5ab8c11171c3b5b92c05e5610de3356ebc971b25dd55abfe40a12478",
      "display": {
        "alignment": "unspecified",
        "description": "Executable Candidate recipe of NVIDIA's DGX Spark playbook (vllm) for Gemma 4 E2B IT: vllm/vllm-openai:gemma4-cu130 (Gemma 4 custom container named by the playbook), pinned by arm64 digest, serving the exact model revision through `vllm serve` with the playbook's flags (vLLM defaults where the playbook passes none). Resource envelopes budget the explicit GPU memory utilization plus unified-memory overhead, not measurements; physical Spark acceptance is pending. GB10 memory correction: GPU utilization 0.90 \u2192 0.85 (previously implicit). Per-node peak budgets utilization \u00d7 130,663,231,488-byte unified memory plus at least 8 GB for CUDA context/graphs, FlashInfer workspace, auxiliary heads and CPU/mmap buffers; 8 GB reserve, with a separate 6 GB OS floor. This is a conservative budget, not a measured footprint. This deviates from the upstream memory profile to avoid unified-memory thrashing; context and other kit flags are retained with a smaller KV pool.",
        "identity": {
          "publisher": "vonk-forge",
          "slug": "gemma-4-e2b-it-nvidia-vllm-single"
        },
        "kind": "recipe-display",
        "tags": [
          "executable",
          "candidate",
          "nvidia",
          "vllm",
          "openai",
          "single",
          "spark",
          "gemma",
          "bf16"
        ],
        "title": "Gemma 4 E2B IT vLLM single Spark (NVIDIA playbook)"
      },
      "document": {
        "execution": {
          "build": {
            "base_image": {
              "digest": "2970dd3c8fd00bccbc663345f9b4d87b35c491f4b13a2a4cdef60fe5c015f6e2",
              "repository": "docker.io/vllm/vllm-openai"
            },
            "context": {
              "path": "adapters/nvidia/gemma-4-e2b-it-nvidia-vllm-single"
            },
            "dockerfile": "adapters/nvidia/gemma-4-e2b-it-nvidia-vllm-single/Dockerfile",
            "network": {
              "hosts": []
            },
            "patches": []
          }
        },
        "identity": {
          "publisher": "vonk-forge",
          "slug": "gemma-4-e2b-it-nvidia-vllm-single"
        },
        "interfaces": [
          {
            "adapter": "openai",
            "health_path": "/v1/models",
            "model_aliases": [
              "gemma-4-e2b-it"
            ],
            "port": 8000
          }
        ],
        "kind": "recipe",
        "models": [
          {
            "files": [
              {
                "file_id": "metadata-34448b82c17d-618cd5b83d",
                "id": "metadata-34448b82c17d-618cd5b83d",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "readme-3e0608a6be80-b335630551",
                "id": "readme-3e0608a6be80-b335630551",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "chat-template-0a2c8073c878-00824420d1",
                "id": "chat-template-0a2c8073c878-00824420d1",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "config-1b28f3d2c310-587cb980af",
                "id": "config-1b28f3d2c310-587cb980af",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "generation-config-d4226bbe3117-97dd3d578b",
                "id": "generation-config-d4226bbe3117-97dd3d578b",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "model-2db5482b20d7-9d75c1098f",
                "id": "model-2db5482b20d7-9d75c1098f",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "processor-config-32bdf45d2ad4-27f0cb76af",
                "id": "processor-config-32bdf45d2ad4-27f0cb76af",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "tokenizer-ab26b2add729-224931eb13",
                "id": "tokenizer-ab26b2add729-224931eb13",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "tokenizer-config-9f4fec4b1dc6-94d5c6ba8f",
                "id": "tokenizer-config-9f4fec4b1dc6-94d5c6ba8f",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              }
            ],
            "id": "primary",
            "model": {
              "content_sha256": "8c3b7f84fa5cc8ae81e13cfeb408e29f47960016284b60d46764037c69cc2414",
              "kind": "model",
              "publisher": "google",
              "slug": "gemma-4-e2b-it-4adf1574"
            }
          }
        ],
        "provenance": {
          "attribution": [
            "NVIDIA",
            "vLLM contributors",
            "Google DeepMind"
          ],
          "source_reference": "https://github.com/NVIDIA/dgx-spark-playbooks/blob/30883150541743d580c9c347700c6ac99fc396d2/nvidia/vllm/README.md"
        },
        "release": {
          "released_at": "2026-11-03",
          "version": "1.0.6"
        },
        "runtime": {
          "arguments": [
            {
              "name": "served-model-name",
              "setting": null,
              "value": "gemma-4-e2b-it"
            },
            {
              "name": "max-model-len",
              "setting": "context_tokens",
              "value": null
            },
            {
              "name": "gpu-memory-utilization",
              "value": "0.85"
            }
          ],
          "engine": "vllm",
          "entrypoint": [
            "/opt/vonk/bin/vllm",
            "serve",
            "/models"
          ],
          "environment": [
            {
              "name": "HF_HUB_OFFLINE",
              "value": "1"
            },
            {
              "name": "TRANSFORMERS_OFFLINE",
              "value": "1"
            }
          ],
          "lifecycle": {
            "stop_timeout_seconds": 180
          }
        },
        "settings": {
          "concurrency": null,
          "context_tokens": {
            "change_effect": "restart",
            "value": 131072
          },
          "kind": "generation",
          "knobs": {},
          "max_batch_tokens": null
        },
        "topology": {
          "name": "solo",
          "node_count": 1,
          "parallelism": {
            "backend": "local",
            "data": 1,
            "pipeline": 1,
            "tensor": 1
          },
          "roles": [
            {
              "count": 1,
              "endpoint_owner": true,
              "name": "entrypoint",
              "resources": {
                "disk": {
                  "artifact_bytes": 10278835678,
                  "image_bytes": 22000000000,
                  "safety_margin_bytes": 12000000000,
                  "working_bytes": 16000000000
                },
                "memory": {
                  "peak_bytes": 119063746765,
                  "reserve_bytes": 8000000000
                }
              }
            }
          ],
          "start_order": [
            "entrypoint"
          ]
        },
        "validation": {
          "serving": {
            "checks": [
              {
                "assertions": [
                  "endpoint.healthy"
                ],
                "kind": "openai.health",
                "name": "health",
                "request": {
                  "body": null,
                  "method": "GET",
                  "path": "/v1/models",
                  "transport": "http"
                }
              },
              {
                "assertions": [
                  "chat.nonempty",
                  "chat.output-cap"
                ],
                "kind": "openai.chat",
                "name": "bounded-chat",
                "request": {
                  "body": {
                    "max_tokens": 64,
                    "messages": [
                      {
                        "content": "hello",
                        "role": "user"
                      }
                    ],
                    "model": "gemma-4-e2b-it"
                  },
                  "method": "POST",
                  "path": "/v1/chat/completions",
                  "transport": "http"
                }
              }
            ],
            "interface": "openai"
          }
        }
      },
      "package": {
        "expected_bytes": 3346,
        "media_type": "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
        "minimum_consumer_schema": 2,
        "path": "packages/gemma-4-e2b-it-nvidia-vllm-single.tar.gz",
        "recipe_content_sha256": "500d52be5ab8c11171c3b5b92c05e5610de3356ebc971b25dd55abfe40a12478",
        "sha256": "9eb4ff20c710d76d4129c5116ad4ccbd92c59cf7e92188d07c8ab724635924f6",
        "source_bundle_sha256": "ace6a27c5ef3e51409ee3b5793e3afd3178574c102987401912abf1aa3febf68"
      },
      "prebuilt_image": {
        "build_key": "98669054da7599dd2a575a1108c2e725b5caa75a8d8e4a752d8be5d496cce42f",
        "reference": "ghcr.io/carstvaartjes/vonk-forge-recipe-gemma-4-e2b-it-nvidia-vllm-single@sha256:57709d569526117a889934e898107aeaa22b5d79fd437eca160c2a2c718de8b7"
      },
      "qualification": {
        "changed": [],
        "last_failure": {
          "blame": "platform",
          "cause_code": "qualification.platform_failure",
          "cause_summary": "Platform issue under fix",
          "evidence_refs": [
            "c5682405ba49fbf83ff8cd793a00e9b5d832ed7314152b271ba31fcbcfb7c31c"
          ],
          "identity": {
            "content_sha256": "49a391613fb8feb6c1a19d8ce6f9a397b59fe6dfecc8806319ae5ad63aba038c",
            "model_digests": [],
            "models_resolved": false,
            "required_sparks": 1
          },
          "outcome": "failed",
          "platform": {
            "controller_source_sha": "78b89d7248495ace35dfd209e9bb2d0f44932bec",
            "hardware_class": "GB10",
            "spark_count": 1,
            "topology": "single"
          },
          "quality_notes": [],
          "tested_at": "2026-10-10T22:10:55.332613Z"
        },
        "last_pass": {
          "cause_code": "qualification.hardware_pass",
          "cause_summary": "Hardware checks passed",
          "evidence_refs": [
            "379290cc9cdec004ddcdd088e06a265228a075d41d186a27072bfe6630851f3a"
          ],
          "identity": {
            "content_sha256": "500d52be5ab8c11171c3b5b92c05e5610de3356ebc971b25dd55abfe40a12478",
            "model_digests": [
              "8c3b7f84fa5cc8ae81e13cfeb408e29f47960016284b60d46764037c69cc2414"
            ],
            "models_resolved": true,
            "required_sparks": 1,
            "runtime_image": {
              "build_key": "98669054da7599dd2a575a1108c2e725b5caa75a8d8e4a752d8be5d496cce42f",
              "image_digest": "sha256:57709d569526117a889934e898107aeaa22b5d79fd437eca160c2a2c718de8b7"
            },
            "source_bundle_sha256": "ace6a27c5ef3e51409ee3b5793e3afd3178574c102987401912abf1aa3febf68"
          },
          "outcome": "passed",
          "platform": {
            "controller_source_sha": "c7f28cef1bb14d3877070c4911d2bc6885e61b89",
            "hardware_class": "GB10",
            "spark_count": 1,
            "topology": "single"
          },
          "quality_notes": [
            "Carried from the identical execution document before the Model facts split"
          ],
          "tested_at": "2026-11-03T23:29:07.790267Z"
        },
        "required_sparks": 1,
        "status": "Working"
      },
      "release": {
        "released_at": "2026-11-03",
        "version": "1.0.6"
      },
      "source_bundle_sha256": "ace6a27c5ef3e51409ee3b5793e3afd3178574c102987401912abf1aa3febf68",
      "source_path": "recipes/gemma-4-e2b-it-nvidia-vllm-single.json"
    },
    {
      "api": {
        "api": {
          "audio_output": false,
          "default_output_tokens": {
            "remaining": "slot_context"
          },
          "endpoints": [
            "/v1/chat/completions",
            "/v1/completions",
            "/v1/responses",
            "/v1/messages"
          ],
          "input_modalities": {
            "audio": true,
            "image": true,
            "pdf": false,
            "text": true,
            "video": true
          },
          "max_input_tokens": null,
          "max_output_tokens": {
            "setting": "context_tokens"
          },
          "mode": "chat",
          "reasoning": {
            "default": "on",
            "effort": null,
            "keys": [
              "enable_thinking"
            ],
            "kind": "switch",
            "off": false,
            "on": true,
            "via": "chat_template_kwargs"
          },
          "streaming": true,
          "structured_output": true,
          "system_messages": true,
          "tools": {
            "kind": "supported",
            "parallel_calls": true,
            "tool_choice": []
          }
        },
        "identity": {
          "publisher": "vonk-forge",
          "slug": "gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single"
        },
        "kind": "recipe-api",
        "option_choices": []
      },
      "content_sha256": "e71d90940d56c753ac5558ae6b04f1c4657d2f747340ad5726eab73c3e7a4bbb",
      "display": {
        "alignment": "unspecified",
        "description": "Executable Candidate llama.cpp recipe based on the ggml-org GGUF repository: the official ggml-org llama.cpp 0.5.0 CUDA 13 server image (arm64, pinned by digest; its default CUDA architectures include GB10 sm_121a) serving the exact GGUF revision through llama-server. NVIDIA's llama.cpp playbook compiles the same upstream source with -DCMAKE_CUDA_ARCHITECTURES=121a-real; this recipe uses the project's published binary instead. Resource envelopes are estimates, not measurements; physical Spark acceptance is pending.",
        "identity": {
          "publisher": "vonk-forge",
          "slug": "gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single"
        },
        "kind": "recipe-display",
        "tags": [
          "executable",
          "candidate",
          "llama-cpp",
          "openai",
          "single",
          "spark",
          "gemma",
          "gguf",
          "q8_0",
          "vision"
        ],
        "title": "Gemma 4 E2B IT Q8_0 llama.cpp single Spark (ggml-org)"
      },
      "document": {
        "execution": {
          "build": {
            "base_image": {
              "digest": "e5a2f80c0f1bdbb829d19b3ba3e84359acad95ea9fae2161661e08af46a31ce0",
              "repository": "ghcr.io/ggml-org/llama.cpp"
            },
            "context": {
              "path": "adapters/nvidia/gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single"
            },
            "dockerfile": "adapters/nvidia/gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single/Dockerfile",
            "network": {
              "hosts": []
            },
            "patches": []
          }
        },
        "identity": {
          "publisher": "vonk-forge",
          "slug": "gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single"
        },
        "interfaces": [
          {
            "adapter": "openai",
            "health_path": "/v1/models",
            "model_aliases": [
              "gemma-4-e2b-it"
            ],
            "port": 8080
          }
        ],
        "kind": "recipe",
        "models": [
          {
            "files": [
              {
                "file_id": "metadata-a1c30820b1ac-618cd5b83d",
                "id": "metadata-a1c30820b1ac-618cd5b83d",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "readme-9dbd5e423137-b335630551",
                "id": "readme-9dbd5e423137-b335630551",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "gemma-4-e2b-it-q8-0-c36d5e6be0d9-ef5b4b1ca4",
                "id": "gemma-4-e2b-it-q8-0-c36d5e6be0d9-ef5b4b1ca4",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "mmproj-gemma-4-e2b-it-q8-0-042cc2561806-3412a371d8",
                "id": "mmproj-gemma-4-e2b-it-q8-0-042cc2561806-3412a371d8",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint"
                ]
              }
            ],
            "id": "primary",
            "model": {
              "content_sha256": "09b8329e18fb1932c89cec4d3f85a7000f9272b87131bd97f6eb0b4b103f876f",
              "kind": "model",
              "publisher": "ggml-org",
              "slug": "gemma-4-e2b-it-q8-0-63f6c6f2"
            }
          }
        ],
        "provenance": {
          "attribution": [
            "ggml-org",
            "llama.cpp contributors",
            "Google DeepMind",
            "ggml-org"
          ],
          "source_reference": "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/tree/63f6c6f23b3e9e5f9737708daec2f88c9ac2e921"
        },
        "release": {
          "released_at": "2026-11-08",
          "version": "0.6.2"
        },
        "runtime": {
          "arguments": [
            {
              "name": "model",
              "setting": null,
              "value": "/models/gemma-4-E2B-it-Q8_0.gguf"
            },
            {
              "name": "alias",
              "setting": null,
              "value": "gemma-4-e2b-it"
            },
            {
              "name": "ctx-size",
              "setting": "context_tokens",
              "value": null
            },
            {
              "name": "mmproj",
              "setting": null,
              "value": "/models/mmproj-gemma-4-E2B-it-Q8_0.gguf"
            },
            {
              "name": "offline",
              "setting": null,
              "value": true
            }
          ],
          "engine": "llama-cpp",
          "entrypoint": [
            "/opt/vonk/bin/llama-server"
          ],
          "environment": [
            {
              "name": "HF_HUB_OFFLINE",
              "value": "1"
            }
          ],
          "lifecycle": {
            "stop_timeout_seconds": 120
          }
        },
        "settings": {
          "concurrency": null,
          "context_tokens": {
            "change_effect": "restart",
            "value": 131072
          },
          "kind": "generation",
          "knobs": {},
          "max_batch_tokens": null
        },
        "topology": {
          "name": "solo",
          "node_count": 1,
          "parallelism": {
            "backend": "local",
            "data": 1,
            "pipeline": 1,
            "tensor": 1
          },
          "roles": [
            {
              "count": 1,
              "endpoint_owner": true,
              "name": "entrypoint",
              "resources": {
                "disk": {
                  "artifact_bytes": 5524862755,
                  "image_bytes": 8000000000,
                  "safety_margin_bytes": 12000000000,
                  "working_bytes": 16000000000
                },
                "memory": {
                  "peak_bytes": 20000000000,
                  "reserve_bytes": 8000000000
                }
              }
            }
          ],
          "start_order": [
            "entrypoint"
          ]
        },
        "validation": {
          "serving": {
            "checks": [
              {
                "assertions": [
                  "endpoint.healthy"
                ],
                "kind": "openai.health",
                "name": "health",
                "request": {
                  "body": null,
                  "method": "GET",
                  "path": "/v1/models",
                  "transport": "http"
                }
              },
              {
                "assertions": [
                  "chat.nonempty",
                  "chat.output-cap"
                ],
                "kind": "openai.chat",
                "name": "bounded-chat",
                "request": {
                  "body": {
                    "max_tokens": 64,
                    "messages": [
                      {
                        "content": "hello",
                        "role": "user"
                      }
                    ],
                    "model": "gemma-4-e2b-it"
                  },
                  "method": "POST",
                  "path": "/v1/chat/completions",
                  "transport": "http"
                }
              }
            ],
            "interface": "openai"
          }
        }
      },
      "measured_memory": {
        "roles": [
          {
            "exceeds_admission_maximum": false,
            "measured_peak_bytes": 10735910912,
            "peak_bytes": 10735910912,
            "role": "entrypoint"
          }
        ]
      },
      "package": {
        "expected_bytes": 3040,
        "media_type": "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
        "minimum_consumer_schema": 2,
        "path": "packages/gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single.tar.gz",
        "recipe_content_sha256": "e71d90940d56c753ac5558ae6b04f1c4657d2f747340ad5726eab73c3e7a4bbb",
        "sha256": "41c18343881ccc3a91e006dbeadfe1cc1ecc51d0b37d7fe08222f1268bf01763",
        "source_bundle_sha256": "356d68104f547f414620e473f1d879cd16b6117b1f50d30c81a483a81cf1d518"
      },
      "prebuilt_image": {
        "build_key": "8a767cd61f48285de25b6c73dbc50d9aace2589128a2fe6ab3e8547be67ec237",
        "reference": "ghcr.io/carstvaartjes/vonk-forge-recipe-gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single@sha256:963aed936485a2123d820321f256666363850b4d137fff1d6a3726bbd1df30a7"
      },
      "qualification": {
        "changed": [],
        "last_failure": {
          "blame": "platform",
          "cause_code": "qualification.platform_failure",
          "cause_summary": "Platform issue under fix",
          "evidence_refs": [
            "340e53fcf88a448fc76e6e1d4eee329417038d472bd40e5ce3c37a2d0b5c355f"
          ],
          "identity": {
            "content_sha256": "4f8a96ba2ae204c533e837601c75775a7a804194b9b3b70efe533336b7148d9d",
            "model_digests": [],
            "models_resolved": false,
            "required_sparks": 1
          },
          "outcome": "failed",
          "platform": {
            "controller_source_sha": "e2e15b7fada10b0af0c601c2008f234886cd6d5b",
            "hardware_class": "GB10",
            "spark_count": 1,
            "topology": "single"
          },
          "quality_notes": [],
          "tested_at": "2026-10-12T17:58:09.360570Z"
        },
        "last_pass": {
          "cause_code": "qualification.hardware_pass",
          "cause_summary": "Hardware checks passed",
          "evidence_refs": [
            "3104548d223d9927d39dc33ec633fe056ae88dca39585570dcdc5066bdc0c2fa"
          ],
          "identity": {
            "content_sha256": "e71d90940d56c753ac5558ae6b04f1c4657d2f747340ad5726eab73c3e7a4bbb",
            "model_digests": [
              "09b8329e18fb1932c89cec4d3f85a7000f9272b87131bd97f6eb0b4b103f876f"
            ],
            "models_resolved": true,
            "required_sparks": 1,
            "runtime_image": {
              "build_key": "8a767cd61f48285de25b6c73dbc50d9aace2589128a2fe6ab3e8547be67ec237",
              "image_digest": "sha256:963aed936485a2123d820321f256666363850b4d137fff1d6a3726bbd1df30a7"
            },
            "source_bundle_sha256": "356d68104f547f414620e473f1d879cd16b6117b1f50d30c81a483a81cf1d518"
          },
          "outcome": "passed",
          "platform": {
            "controller_source_sha": "88d096fbe166e5668715cb2d52bc2328c3f44828",
            "hardware_class": "GB10",
            "spark_count": 1,
            "topology": "single"
          },
          "quality_notes": [
            "Model output differed from the expected answer"
          ],
          "tested_at": "2026-11-08T09:05:04.530387Z"
        },
        "required_sparks": 1,
        "status": "Working"
      },
      "release": {
        "released_at": "2026-11-08",
        "version": "0.6.2"
      },
      "source_bundle_sha256": "356d68104f547f414620e473f1d879cd16b6117b1f50d30c81a483a81cf1d518",
      "source_path": "recipes/gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single.json"
    },
    {
      "api": null,
      "content_sha256": "eb5a8bfeca693e6d2cd3974205ff4d9830a4b063609f920b63a320c81c233c38",
      "display": {
        "alignment": "unspecified",
        "description": "Complete offline Candidate TP8 recipe for Thinking Machines' flagship Inkling NVFP4 checkpoint. Its exact eight-rank topology is unsupported on Vonk's current one- or two-Spark configuration: a two-rank split alone would require at least 296.0 GB of checkpoint bytes per Spark before KV cache or runtime overhead. The executable contract remains installable for a future eight-Spark canary and has no DGX Spark physical evidence. Inkling Small NVFP4 dual is the same-family alternative for text, image, and 16 kHz WAV audio, but its current 128 GB Controller admission envelope also needs either at least 128 GB free per node or a separately proven lower-memory profile.",
        "identity": {
          "publisher": "vonk-forge",
          "slug": "inkling-975b-a41b-nvfp4-sglang-eight"
        },
        "kind": "recipe-display",
        "tags": [
          "executable",
          "audio",
          "candidate",
          "distributed",
          "image",
          "inkling",
          "multimodal",
          "nvfp4",
          "reasoning",
          "sglang",
          "spark",
          "text",
          "tool-use",
          "tp8"
        ],
        "title": "Inkling 975B-A41B NVFP4 SGLang eight Sparks"
      },
      "document": {
        "execution": {
          "build": {
            "base_image": {
              "digest": "b0d8718a4424bb22e448e04407ab3ce5f7399a4c5fc702d6fbe36c3772ec8862",
              "repository": "docker.io/lmsysorg/sglang"
            },
            "context": {
              "path": "adapters/llm/inkling-sglang-eight"
            },
            "dockerfile": "adapters/llm/inkling-sglang-eight/Dockerfile",
            "network": {
              "hosts": []
            },
            "patches": []
          }
        },
        "identity": {
          "publisher": "vonk-forge",
          "slug": "inkling-975b-a41b-nvfp4-sglang-eight"
        },
        "interfaces": [
          {
            "adapter": "openai",
            "health_path": "/v1/models",
            "model_aliases": [
              "inkling"
            ],
            "port": 30000
          }
        ],
        "kind": "recipe",
        "models": [
          {
            "files": [
              {
                "file_id": "metadata-deb930275aeb",
                "id": "primary-metadata-deb930275aeb",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "readme-2ea1315d3948",
                "id": "primary-readme-2ea1315d3948",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "chat-template-0aa1aa0c729d",
                "id": "primary-chat-template-0aa1aa0c729d",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "config-58720f145bce",
                "id": "primary-config-58720f145bce",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "hf-quant-config-13277ee163a6",
                "id": "primary-hf-quant-config-13277ee163a6",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00001-of-00033-d23be7ca189d",
                "id": "primary-model-00001-of-00033-d23be7ca189d",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00002-of-00033-41b33ae96076",
                "id": "primary-model-00002-of-00033-41b33ae96076",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00003-of-00033-fe781903b1bb",
                "id": "primary-model-00003-of-00033-fe781903b1bb",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00004-of-00033-cfd2beda8c08",
                "id": "primary-model-00004-of-00033-cfd2beda8c08",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00005-of-00033-b19b96fb7ace",
                "id": "primary-model-00005-of-00033-b19b96fb7ace",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00006-of-00033-e718c10c7770",
                "id": "primary-model-00006-of-00033-e718c10c7770",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00007-of-00033-74fc6ed7fec4",
                "id": "primary-model-00007-of-00033-74fc6ed7fec4",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00008-of-00033-e47c3b0b413c",
                "id": "primary-model-00008-of-00033-e47c3b0b413c",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00009-of-00033-d07c90536ed4",
                "id": "primary-model-00009-of-00033-d07c90536ed4",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00010-of-00033-1fcc29248d30",
                "id": "primary-model-00010-of-00033-1fcc29248d30",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00011-of-00033-6acd555f7925",
                "id": "primary-model-00011-of-00033-6acd555f7925",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00012-of-00033-86d80117e4de",
                "id": "primary-model-00012-of-00033-86d80117e4de",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00013-of-00033-13307919a112",
                "id": "primary-model-00013-of-00033-13307919a112",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00014-of-00033-554ea1d6bf0b",
                "id": "primary-model-00014-of-00033-554ea1d6bf0b",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00015-of-00033-9f93de27a392",
                "id": "primary-model-00015-of-00033-9f93de27a392",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00016-of-00033-e0f295b3871f",
                "id": "primary-model-00016-of-00033-e0f295b3871f",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00017-of-00033-9373b84f05de",
                "id": "primary-model-00017-of-00033-9373b84f05de",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00018-of-00033-75dae1981cd6",
                "id": "primary-model-00018-of-00033-75dae1981cd6",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00019-of-00033-d6302d4e1c1d",
                "id": "primary-model-00019-of-00033-d6302d4e1c1d",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00020-of-00033-c1e547007ec0",
                "id": "primary-model-00020-of-00033-c1e547007ec0",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00021-of-00033-10ad49ad1a9f",
                "id": "primary-model-00021-of-00033-10ad49ad1a9f",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00022-of-00033-52e84a65712c",
                "id": "primary-model-00022-of-00033-52e84a65712c",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00023-of-00033-3aaf8a3bba4c",
                "id": "primary-model-00023-of-00033-3aaf8a3bba4c",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00024-of-00033-9b889e3657ce",
                "id": "primary-model-00024-of-00033-9b889e3657ce",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00025-of-00033-8d7577d69d5c",
                "id": "primary-model-00025-of-00033-8d7577d69d5c",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00026-of-00033-f00eb775e4d2",
                "id": "primary-model-00026-of-00033-f00eb775e4d2",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00027-of-00033-22006739079d",
                "id": "primary-model-00027-of-00033-22006739079d",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00028-of-00033-16fcb85bb6b1",
                "id": "primary-model-00028-of-00033-16fcb85bb6b1",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00029-of-00033-a37f89d84360",
                "id": "primary-model-00029-of-00033-a37f89d84360",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00030-of-00033-4afa6d80ea00",
                "id": "primary-model-00030-of-00033-4afa6d80ea00",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00031-of-00033-a15ba8214581",
                "id": "primary-model-00031-of-00033-a15ba8214581",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00032-of-00033-91a6e0d6613e",
                "id": "primary-model-00032-of-00033-91a6e0d6613e",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-00033-of-00033-de00ac84eb64",
                "id": "primary-model-00033-of-00033-de00ac84eb64",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "model-safetensors-index-23e5784d5695",
                "id": "primary-model-safetensors-index-23e5784d5695",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "mtp-a0a01bf72ac4",
                "id": "primary-mtp-a0a01bf72ac4",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "processor-config-b4a3962ea5f7",
                "id": "primary-processor-config-b4a3962ea5f7",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "special-tokens-map-abc97715b4b3",
                "id": "primary-special-tokens-map-abc97715b4b3",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "tokenizer-bc253fd2b702",
                "id": "primary-tokenizer-bc253fd2b702",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "tokenizer-9fb6333a7db8",
                "id": "primary-tokenizer-9fb6333a7db8",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              },
              {
                "file_id": "tokenizer-config-2e36c9748a20",
                "id": "primary-tokenizer-config-2e36c9748a20",
                "mount": {
                  "target": "/models"
                },
                "roles": [
                  "entrypoint",
                  "worker"
                ]
              }
            ],
            "id": "primary",
            "model": {
              "content_sha256": "3318872c643e6f5c95ed4b3fd61a79861414de5de39e1e1b5f85a719f6fd94ae",
              "kind": "model",
              "publisher": "thinkingmachines",
              "slug": "inkling-975b-a41b-nvfp4"
            }
          }
        ],
        "provenance": {
          "attribution": [
            "Thinking Machines Lab",
            "SGLang contributors",
            "NVIDIA DGX Spark",
            "Vonk Forge"
          ],
          "source_reference": "https://github.com/sgl-project/sglang/tree/94602c9c2b7cbdb8efd5c52802dac6a1c180089e"
        },
        "release": {
          "released_at": "2026-09-18",
          "version": "0.5.20"
        },
        "runtime": {
          "arguments": [
            {
              "name": "model-path",
              "setting": null,
              "value": "/models"
            },
            {
              "name": "served-model-name",
              "setting": null,
              "value": "inkling"
            },
            {
              "name": "tp",
              "setting": null,
              "value": 8
            },
            {
              "name": "context-length",
              "setting": "context_tokens",
              "value": null
            },
            {
              "name": "quantization",
              "setting": null,
              "value": "modelopt_fp4"
            },
            {
              "name": "attention-backend",
              "setting": null,
              "value": "triton"
            },
            {
              "name": "page-size",
              "setting": null,
              "value": 128
            },
            {
              "name": "fp4-gemm-backend",
              "setting": null,
              "value": "marlin"
            },
            {
              "name": "moe-runner-backend",
              "setting": null,
              "value": "marlin"
            },
            {
              "name": "mamba-radix-cache-strategy",
              "setting": null,
              "value": "extra_buffer"
            },
            {
              "name": "mem-fraction-static",
              "setting": null,
              "value": "0.80"
            },
            {
              "name": "swa-full-tokens-ratio",
              "setting": null,
              "value": "0.10"
            },
            {
              "name": "mamba-full-memory-ratio",
              "setting": null,
              "value": "0.10"
            },
            {
              "name": "enable-multimodal",
              "setting": null,
              "value": true
            },
            {
              "name": "disable-prefill-cuda-graph",
              "setting": null,
              "value": true
            },
            {
              "name": "reasoning-parser",
              "setting": null,
              "value": "inkling"
            },
            {
              "name": "tool-call-parser",
              "setting": null,
              "value": "inkling"
            },
            {
              "name": "trust-remote-code",
              "setting": null,
              "value": true
            }
          ],
          "engine": "sglang",
          "entrypoint": [
            "/opt/vonk/bin/sglang-serve"
          ],
          "environment": [
            {
              "name": "HF_HUB_OFFLINE",
              "value": "1"
            },
            {
              "name": "SGLANG_ENABLE_UNIFIED_RADIX_TREE",
              "value": "1"
            },
            {
              "name": "NCCL_DEBUG",
              "value": "WARN"
            }
          ],
          "lifecycle": {
            "stop_timeout_seconds": 180
          }
        },
        "settings": {
          "concurrency": null,
          "context_tokens": {
            "change_effect": "restart",
            "value": 262144
          },
          "kind": "generation",
          "knobs": {},
          "max_batch_tokens": null
        },
        "topology": {
          "name": "eight",
          "node_count": 8,
          "parallelism": {
            "backend": "native",
            "data": 1,
            "pipeline": 1,
            "tensor": 8
          },
          "roles": [
            {
              "count": 1,
              "endpoint_owner": true,
              "name": "entrypoint",
              "resources": {
                "disk": {
                  "artifact_bytes": 592037337118,
                  "image_bytes": 40000000000,
                  "safety_margin_bytes": 50000000000,
                  "working_bytes": 1234074674236
                },
                "memory": {
                  "peak_bytes": 119000000000,
                  "reserve_bytes": 8000000000
                }
              }
            },
            {
              "count": 7,
              "endpoint_owner": false,
              "name": "worker",
              "resources": {
                "disk": {
                  "artifact_bytes": 592037337118,
                  "image_bytes": 40000000000,
                  "safety_margin_bytes": 50000000000,
                  "working_bytes": 1234074674236
                },
                "memory": {
                  "peak_bytes": 119000000000,
                  "reserve_bytes": 8000000000
                }
              }
            }
          ],
          "start_order": [
            "worker",
            "entrypoint"
          ]
        },
        "validation": {
          "serving": {
            "checks": [
              {
                "assertions": [
                  "endpoint.healthy"
                ],
                "kind": "openai.health",
                "name": "health",
                "request": {
                  "body": null,
                  "method": "GET",
                  "path": "/v1/models",
                  "transport": "http"
                }
              },
              {
                "assertions": [
                  "chat.nonempty",
                  "chat.output-cap"
                ],
                "kind": "openai.chat",
                "name": "bounded-chat",
                "request": {
                  "body": {
                    "max_tokens": 64,
                    "messages": [
                      {
                        "content": "hello",
                        "role": "user"
                      }
                    ],
                    "model": "inkling"
                  },
                  "method": "POST",
                  "path": "/v1/chat/completions",
                  "transport": "http"
                }
              }
            ],
            "interface": "openai"
          }
        }
      },
      "package": {
        "expected_bytes": 9573,
        "media_type": "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
        "minimum_consumer_schema": 2,
        "path": "packages/inkling-975b-a41b-nvfp4-sglang-eight.tar.gz",
        "recipe_content_sha256": "eb5a8bfeca693e6d2cd3974205ff4d9830a4b063609f920b63a320c81c233c38",
        "sha256": "8d7190ac5428a5888769c8afda8ddd208ea4f9a2ad1ab7d91d649d20cb19bb6c",
        "source_bundle_sha256": "c20327467ef6404faf4cad5b664801aa5009365181aa58584c863beb8a589208"
      },
      "prebuilt_image": {
        "build_key": "fdaef7a17b5e8023ca78e55703b81935062ec892af7b293fc282a55d6d53b5d7",
        "reference": "ghcr.io/carstvaartjes/vonk-forge-recipe-inkling-975b-a41b-nvfp4-sglang-eight@sha256:a51c04bd3d4beb3fbce0363197a451e1936f48c7b7cf364e2aa5b7850f33c65f"
      },
      "qualification": {
        "changed": [],
        "reason": "needs more Sparks",
        "required_sparks": 8,
        "status": "Not yet verified"
      },
      "release": {
        "released_at": "2026-09-18",
        "version": "0.5.20"
      },
      "source_bundle_sha256": "c20327467ef6404faf4cad5b664801aa5009365181aa58584c863beb8a589208",
      "source_path": "recipes/inkling-975b-a41b-nvfp4-sglang-eight.json"
    },
    {
      "api": null,
      "content_sha256": "ba4599a692b99bc973d8e9d9b75f2c98a194075a5f475889621d4cbff43e1e76",
      "display": {
        "alignment": "unspecified",
        "description": "Installable but not accepted SkinTokens/TokenRig single-Spark Candidate with an exact upstream source build, offline checkpoint binding, and deterministic rigged-GLB exporter. The native ARM64 container build is unvalidated and both that build and a physical GB10 rigged-GLB canary must pass before acceptance.",
        "identity": {
          "publisher": "vonk-forge",
          "slug": "skintokens-pytorch-single"
        },
        "kind": "recipe-display",
        "tags": [
          "executable",
          "candidate",
          "three-d",
          "pytorch-pipeline",
          "single",
          "spark",
          "rigging",
          "native",
          "build-unvalidated",
          "native-build-required",
          "physical-acceptance-required"
        ],
        "title": "SkinTokens / TokenRig pytorch-pipeline single Spark"
      },
      "document": {
        "execution": {
          "build": {
            "base_image": {
              "digest": "d44d6dc249c2c8330d0b380c595a514f0e86137fcc717fe7a4389a25720ade37",
              "repository": "nvcr.io/nvidia/cuda"
            },
            "context": {
              "path": "adapters/three-d/skintokens"
            },
            "dockerfile": "adapters/three-d/skintokens/Dockerfile",
            "network": {
              "hosts": [
                "codeload.github.com",
                "huggingface.co",
                "download.pytorch.org",
                "download-r2.pytorch.org",
                "pypi.org",
                "pypi.nvidia.com",
                "files.pythonhosted.org",
                "archive.ubuntu.com",
                "security.ubuntu.com",
                "ports.ubuntu.com"
              ]
            },
            "patches": []
          }
        },
        "identity": {
          "publisher": "vonk-forge",
          "slug": "skintokens-pytorch-single"
        },
        "interfaces": [
          {
            "adapter": "mesh-job",
            "input": {
              "max_bytes": 268435456,
              "media_types": [
                "model/gltf-binary"
              ],
              "required": true,
              "slots": [
                {
                  "description": "One GLB character mesh to rig with SkinTokens.",
                  "extensions": [
                    ".glb"
                  ],
                  "id": "mesh",
                  "label": "Character mesh",
                  "max_file_bytes": 268435456,
                  "max_files": 1,
                  "max_total_bytes": 268435456,
                  "media_types": [
                    "model/gltf-binary"
                  ],
                  "min_files": 1
                }
              ]
            },
            "output": {
              "max_total_bytes": 536870912,
              "slots": [
                {
                  "description": "The rigged SkinTokens binary glTF mesh.",
                  "extensions": [
                    ".glb"
                  ],
                  "id": "mesh",
                  "label": "Rigged mesh",
                  "max_file_bytes": 536870912,
                  "max_files": 1,
                  "max_total_bytes": 536870912,
                  "media_types": [
                    "model/gltf-binary"
                  ],
                  "min_files": 1
                }
              ]
            }
          }
        ],
        "kind": "recipe",
        "models": [
          {
            "files": [
              {
                "file_id": "grpo-1400-f4e4706a11cf-0a004da47f",
                "id": "primary-001",
                "mount": {
                  "target": "/models/target"
                },
                "roles": [
                  "entrypoint"
                ]
              },
              {
                "file_id": "last-4843f49e58af-3417e359c3",
                "id": "primary-002",
                "mount": {
                  "target": "/models/target"
                },
                "roles": [
                  "entrypoint"
                ]
              }
            ],
            "id": "primary",
            "model": {
              "content_sha256": "a96dff28e02b7a3040a4bc4d53d0e64823a2d8f7fbb8b96e079c91fc7b9e71ab",
              "kind": "model",
              "publisher": "vast-ai",
              "slug": "skintokens"
            }
          }
        ],
        "provenance": {
          "attribution": [
            "vast-ai"
          ],
          "source_reference": "https://huggingface.co/VAST-AI/SkinTokens/tree/79736cad0fd84de384d5eede659b4ebd24effe33"
        },
        "release": {
          "released_at": "2026-10-26",
          "version": "2.0.16"
        },
        "runtime": {
          "arguments": [
            {
              "name": "entrypoint",
              "setting": null,
              "value": "/opt/vonk/source/run.py"
            },
            {
              "name": "output-mime",
              "setting": null,
              "value": "model/gltf-binary"
            },
            {
              "name": "timeout-seconds",
              "setting": null,
              "value": 3600
            },
            {
              "name": "seed",
              "setting": null,
              "value": 0
            }
          ],
          "engine": "pytorch-pipeline",
          "entrypoint": [
            "/opt/vonk/bin/pytorch-pipeline"
          ],
          "environment": [
            {
              "name": "HF_HUB_OFFLINE",
              "value": "1"
            }
          ],
          "lifecycle": {
            "stop_timeout_seconds": 120
          }
        },
        "settings": {
          "concurrency": null,
          "kind": "job",
          "knobs": {}
        },
        "topology": {
          "name": "solo",
          "node_count": 1,
          "parallelism": {
            "backend": "local",
            "data": 1,
            "pipeline": 1,
            "tensor": 1
          },
          "roles": [
            {
              "count": 1,
              "endpoint_owner": true,
              "name": "entrypoint",
              "resources": {
                "disk": {
                  "artifact_bytes": 1618915724,
                  "image_bytes": 16000000000,
                  "safety_margin_bytes": 12000000000,
                  "working_bytes": 24000000000
                },
                "memory": {
                  "peak_bytes": 48000000000,
                  "reserve_bytes": 8000000000
                }
              }
            }
          ],
          "start_order": [
            "entrypoint"
          ]
        },
        "validation": {
          "serving": {
            "checks": [
              {
                "assertions": [
                  "inference.completed",
                  "artifact.output"
                ],
                "kind": "mesh-job.output",
                "name": "job-output",
                "request": {
                  "fixture": "qualification/fixtures/tiny.glb",
                  "input_slots": {
                    "mesh": "qualification/fixtures/tiny.glb"
                  },
                  "output_slot": "mesh",
                  "transport": "job"
                }
              }
            ],
            "interface": "mesh-job"
          }
        }
      },
      "package": {
        "expected_bytes": 20310,
        "media_type": "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
        "minimum_consumer_schema": 2,
        "path": "packages/skintokens-pytorch-single.tar.gz",
        "recipe_content_sha256": "ba4599a692b99bc973d8e9d9b75f2c98a194075a5f475889621d4cbff43e1e76",
        "sha256": "81ad3fd5f987c304f99cbaee05d7238c2c68d851e051742fc46d066d48ddab92",
        "source_bundle_sha256": "4744684d8ba00c3a6a629815d251033d94475dc8c0eebd1952424a1ff8014466"
      },
      "prebuilt_image": {
        "build_key": "ca53aa8193aadf6f56b78b90add14983c2f7fca6386b71d904ec493e2832fc62",
        "reference": "ghcr.io/carstvaartjes/vonk-forge-recipe-skintokens-pytorch-single@sha256:16526fefd42d370dc56a27b457c6ca75042c9602cbb8b437a6e09526944d9804"
      },
      "qualification": {
        "changed": [],
        "last_failure": {
          "blame": "recipe",
          "cause_code": "qualification.serving_assertion",
          "cause_summary": "Serving checks failed; needs fix",
          "evidence_refs": [
            "4cdf45a76ccc135866542534f8dc997812a50943f253b15e07bf9f04c15fb371"
          ],
          "identity": {
            "content_sha256": "ba4599a692b99bc973d8e9d9b75f2c98a194075a5f475889621d4cbff43e1e76",
            "model_digests": [
              "a96dff28e02b7a3040a4bc4d53d0e64823a2d8f7fbb8b96e079c91fc7b9e71ab"
            ],
            "models_resolved": true,
            "required_sparks": 1,
            "runtime_image": {
              "build_key": "ca53aa8193aadf6f56b78b90add14983c2f7fca6386b71d904ec493e2832fc62",
              "image_digest": "sha256:16526fefd42d370dc56a27b457c6ca75042c9602cbb8b437a6e09526944d9804"
            },
            "source_bundle_sha256": "4744684d8ba00c3a6a629815d251033d94475dc8c0eebd1952424a1ff8014466"
          },
          "outcome": "failed",
          "platform": {
            "controller_source_sha": "7fc22e5ff80e38e835c65cd68eefb4bf389f9d75",
            "hardware_class": "GB10",
            "spark_count": 1,
            "topology": "single"
          },
          "quality_notes": [
            "Carried from the identical document before the display split",
            "Carried from the identical execution document before the Model facts split"
          ],
          "tested_at": "2026-10-26T12:24:18.409131Z"
        },
        "last_pass": {
          "cause_code": "qualification.hardware_pass",
          "cause_summary": "Hardware checks passed",
          "evidence_refs": [
            "c3a185f04d1ee5070c624271966f6141f9e53fd16592ee4c5cf035b4c415c4ea"
          ],
          "identity": {
            "content_sha256": "ba4599a692b99bc973d8e9d9b75f2c98a194075a5f475889621d4cbff43e1e76",
            "model_digests": [
              "a96dff28e02b7a3040a4bc4d53d0e64823a2d8f7fbb8b96e079c91fc7b9e71ab"
            ],
            "models_resolved": true,
            "required_sparks": 1,
            "runtime_image": {
              "build_key": "ca53aa8193aadf6f56b78b90add14983c2f7fca6386b71d904ec493e2832fc62",
              "image_digest": "sha256:16526fefd42d370dc56a27b457c6ca75042c9602cbb8b437a6e09526944d9804"
            },
            "source_bundle_sha256": "4744684d8ba00c3a6a629815d251033d94475dc8c0eebd1952424a1ff8014466"
          },
          "outcome": "passed",
          "platform": {
            "controller_source_sha": "7fc22e5ff80e38e835c65cd68eefb4bf389f9d75",
            "hardware_class": "GB10",
            "spark_count": 1,
            "topology": "single"
          },
          "quality_notes": [
            "Carried from the identical document before the display split",
            "Carried from the identical execution document before the Model facts split"
          ],
          "tested_at": "2026-10-26T16:36:31.282892Z"
        },
        "required_sparks": 1,
        "status": "Working"
      },
      "release": {
        "released_at": "2026-10-26",
        "version": "2.0.16"
      },
      "source_bundle_sha256": "4744684d8ba00c3a6a629815d251033d94475dc8c0eebd1952424a1ff8014466",
      "source_path": "recipes/skintokens-pytorch-single.json"
    }
  ]
} satisfies CatalogIndex;
